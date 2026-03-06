import { env } from '../../config/env.js';
import { withTx } from '../../config/db.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { haversineKm } from '../../utils/geo.js';
import { computeDistanceAmountMad, computeMealAmountMad } from '../../utils/money.js';
import { getDrivingDistanceKm } from './osrm.client.js';

function normalizeGpsNumber(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) throw badRequest('Coordonnées GPS invalides', 'VALIDATION_ERROR');
  return x;
}

export async function createAndSubmitTravel({
  creatorUserId,
  payload,
  client
}) {
  const departureCityId = payload.departureCityId;
  const destinationCityId = payload.destinationCityId;
  const missionDate = payload.missionDate;
  const comments = payload.comments ?? null;

  const submissionLat = normalizeGpsNumber(payload.submissionLat);
  const submissionLon = normalizeGpsNumber(payload.submissionLon);

  const lunchSelected = Boolean(payload.lunchSelected);
  const dinnerSelected = Boolean(payload.dinnerSelected);
  const colleagues = payload.colleagues ?? [];

  const { rows: cityRows } = await client.query(
    `select id, name, lat::float8 as lat, lon::float8 as lon
     from public.cities
     where id = any($1::uuid[])`,
    [[departureCityId, destinationCityId]]
  );
  const departureCity = cityRows.find((c) => c.id === departureCityId);
  const destinationCity = cityRows.find((c) => c.id === destinationCityId);
  if (!departureCity) throw notFound('Ville de départ introuvable', 'CITY_NOT_FOUND');
  if (!destinationCity) throw notFound('Ville de destination introuvable', 'CITY_NOT_FOUND');

  // Distance routière (OSRM) entre villes (théoriques)
  const distanceKmRaw = await getDrivingDistanceKm({
    from: { lat: departureCity.lat, lon: departureCity.lon },
    to: { lat: destinationCity.lat, lon: destinationCity.lon }
  });
  const distanceKm = Math.round(distanceKmRaw * 1000) / 1000;

  // Anti-fraude : GPS réel du technicien vs position théorique de la ville de départ
  const gpsCityKm = haversineKm(
    { lat: submissionLat, lon: submissionLon },
    { lat: departureCity.lat, lon: departureCity.lon }
  );

  const isSuspicious = gpsCityKm > env.FRAUD_GPS_CITY_THRESHOLD_KM;
  const suspicionReason = isSuspicious
    ? `GPS trop éloigné de la ville de départ: ${gpsCityKm.toFixed(1)} km (> ${env.FRAUD_GPS_CITY_THRESHOLD_KM} km)`
    : null;

  // Remboursement : la distance est remboursée UNIQUEMENT au conducteur (créateur)
  const distanceAmountMad = computeDistanceAmountMad(distanceKm);
  const mealAmountMad = computeMealAmountMad({ lunchSelected, dinnerSelected });
  const totalAmountMad = distanceAmountMad + mealAmountMad;

  // Collègues : repas uniquement (pas de distance)
  const colleagueRows = [];
  for (const c of colleagues) {
    const userId = c.userId;
    if (!userId) throw badRequest('colleagues[].userId manquant', 'VALIDATION_ERROR');
    if (userId === creatorUserId) throw badRequest('Le conducteur ne peut pas être ajouté comme collègue', 'VALIDATION_ERROR');

    const m = computeMealAmountMad({
      lunchSelected: Boolean(c.lunchSelected),
      dinnerSelected: Boolean(c.dinnerSelected)
    });
    colleagueRows.push({
      userId,
      lunchSelected: Boolean(c.lunchSelected),
      dinnerSelected: Boolean(c.dinnerSelected),
      mealAmountMad: m
    });
  }

  const inserted = await client.query(
    `insert into public.travel_declarations (
        creator_id, status,
        departure_city_id, destination_city_id,
        mission_date, comments,
        submission_lat, submission_lon,
        distance_km, lunch_selected, dinner_selected,
        distance_amount_mad, meal_amount_mad, total_amount_mad,
        is_suspicious, suspicion_reason,
        submitted_at, created_at, updated_at
     ) values (
        $1, 'PENDING_VALIDATION',
        $2, $3,
        $4, $5,
        $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        $14, $15,
        now(), now(), now()
     )
     returning id`,
    [
      creatorUserId,
      departureCityId,
      destinationCityId,
      missionDate,
      comments,
      submissionLat,
      submissionLon,
      distanceKm,
      lunchSelected,
      dinnerSelected,
      distanceAmountMad,
      mealAmountMad,
      totalAmountMad,
      isSuspicious,
      suspicionReason
    ]
  );
  const travelId = inserted.rows[0].id;

  if (colleagueRows.length) {
    const values = [];
    const params = [];
    let i = 1;
    for (const row of colleagueRows) {
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
      params.push(travelId, row.userId, row.lunchSelected, row.dinnerSelected, row.mealAmountMad);
    }
    await client.query(
      `insert into public.travel_colleagues
        (travel_declaration_id, user_id, lunch_selected, dinner_selected, meal_amount_mad)
       values ${values.join(', ')}`,
      params
    );
  }

  if (isSuspicious) {
    await client.query(
      `insert into public.fraud_alerts (travel_declaration_id, alert_type, severity, description)
       values ($1, 'GPS_MISMATCH', 'HIGH', $2)`,
      [travelId, suspicionReason]
    );
  }

  await client.query(
    `insert into public.activity_logs (user_id, action_type, entity_type, entity_id, metadata)
     values ($1, 'SUBMIT_DECLARATION', 'TRAVEL_DECLARATION', $2, $3::jsonb)`,
    [
      creatorUserId,
      travelId,
      JSON.stringify({
        departureCity: { id: departureCity.id, name: departureCity.name },
        destinationCity: { id: destinationCity.id, name: destinationCity.name },
        submission: { lat: submissionLat, lon: submissionLon },
        computed: {
          distanceKm,
          gpsDistanceToDepartureCityKm: Math.round(gpsCityKm * 10) / 10,
          isSuspicious
        },
        reimbursement: {
          driver: { distanceAmountMad, mealAmountMad, totalAmountMad },
          colleaguesCount: colleagueRows.length
        }
      })
    ]
  );

  return {
    id: travelId,
    status: 'PENDING_VALIDATION',
    isSuspicious,
    suspicionReason,
    distanceKm,
    driverAmounts: { distanceAmountMad, mealAmountMad, totalAmountMad },
    colleagues: colleagueRows.map((r) => ({
      userId: r.userId,
      mealAmountMad: r.mealAmountMad,
      lunchSelected: r.lunchSelected,
      dinnerSelected: r.dinnerSelected
    }))
  };
}

export async function submitTravelAsTechnician({ creatorUserId, payload }) {
  return withTx((client) => createAndSubmitTravel({ creatorUserId, payload, client }));
}

