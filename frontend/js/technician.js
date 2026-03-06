import { http, getCurrentUser, clearSession } from './app/http.js';

const state = {
  gps: {
    lat: null,
    lon: null
  }
};

function ensureAuthenticatedTechnician() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  if (user.role !== 'TECHNICIAN') {
    window.location.href = 'admin.html';
    return null;
  }
  return user;
}

function setGpsStatus(text, coordsText = '') {
  const statusEl = document.getElementById('gps-status');
  const coordsEl = document.getElementById('gps-coords');
  statusEl.textContent = text;
  coordsEl.textContent = coordsText;
}

function captureGps() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('GPS non disponible sur cet appareil.'));
      return;
    }
    setGpsStatus('GPS : capture en cours...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        state.gps.lat = latitude;
        state.gps.lon = longitude;
        const coordsText = `Lat: ${latitude.toFixed(6)}, Lon: ${longitude.toFixed(6)}`;
        setGpsStatus('GPS : capturé', coordsText);
        resolve({ latitude, longitude });
      },
      (err) => {
        console.error(err);
        setGpsStatus('GPS : échec de la capture');
        reject(new Error('Impossible de récupérer la position GPS.'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

async function loadCities() {
  const selectDeparture = document.getElementById('departureCity');
  const selectDestination = document.getElementById('destinationCity');
  try {
    // Suppose un endpoint GET /api/cities qui renvoie [{ id, name }]
    const cities = await http.get('/api/cities');
    for (const city of cities) {
      const opt1 = document.createElement('option');
      opt1.value = city.id;
      opt1.textContent = city.name;
      selectDeparture.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = city.id;
      opt2.textContent = city.name;
      selectDestination.appendChild(opt2);
    }
  } catch (err) {
    console.error('Erreur chargement villes', err);
  }
}

async function loadColleagues() {
  const select = document.getElementById('colleagues');
  try {
    // Suppose un endpoint GET /api/users?role=TECHNICIAN
    const data = await http.get('/api/users?role=TECHNICIAN');
    const me = getCurrentUser();
    for (const user of data.items || data) {
      if (me && user.id === me.id) continue;
      const opt = document.createElement('option');
      opt.value = user.id;
      opt.textContent = user.fullName || user.username;
      select.appendChild(opt);
    }
  } catch (err) {
    console.error('Erreur chargement collègues', err);
  }
}

async function loadHistory() {
  const tbody = document.getElementById('history-body');
  tbody.innerHTML = '';
  try {
    const data = await http.get('/api/travels/my');
    const items = data.items || [];
    if (!items.length) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td colspan="6" class="px-3 py-3 text-center text-xs text-slate-500">Aucune déclaration pour le moment.</td>';
      tbody.appendChild(tr);
      return;
    }
    for (const t of items) {
      const tr = document.createElement('tr');
      const meals =
        (t.lunch_selected ? 'Déj ' : '') + (t.dinner_selected ? 'Dîn' : '') || '-';
      const statusBadge = buildStatusBadge(t.status, t.is_suspicious);
      tr.innerHTML = `
        <td class="px-3 py-2 whitespace-nowrap">${t.mission_date || '-'}</td>
        <td class="px-3 py-2 whitespace-nowrap">${t.departure_city_name || ''} → ${
        t.destination_city_name || ''
      }</td>
        <td class="px-3 py-2">${t.distance_km ? t.distance_km.toFixed(1) + ' km' : '-'}</td>
        <td class="px-3 py-2">${meals}</td>
        <td class="px-3 py-2">${t.total_amount_mad ? t.total_amount_mad.toFixed(2) : '0.00'} MAD</td>
        <td class="px-3 py-2">${statusBadge}</td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error('Erreur chargement historique', err);
  }
}

function buildStatusBadge(status, isSuspicious) {
  if (isSuspicious) {
    return '<span class="badge-status-suspicious">Suspicious</span>';
  }
  switch (status) {
    case 'APPROVED':
      return '<span class="badge-status-approved">Approuvée</span>';
    case 'REJECTED':
      return '<span class="badge-status-rejected">Rejetée</span>';
    case 'PENDING_VALIDATION':
      return '<span class="badge-status-pending">En attente</span>';
    case 'DRAFT':
      return '<span class="badge-status">Brouillon</span>';
    default:
      return '<span class="badge-status">—</span>';
  }
}

function setupLogout() {
  const btn = document.getElementById('logout-btn');
  btn.addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });
}

function setTodayAsDefaultDate() {
  const input = document.getElementById('missionDate');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  input.value = `${yyyy}-${mm}-${dd}`;
}

function getSelectedColleagues() {
  const select = document.getElementById('colleagues');
  const values = [];
  for (const opt of select.options) {
    if (opt.selected && opt.value) {
      values.push({ userId: opt.value, lunchSelected: true, dinnerSelected: true });
    }
  }
  return values;
}

async function handleSubmit(e) {
  e.preventDefault();
  const formError = document.getElementById('form-error');
  const formSuccess = document.getElementById('form-success');
  const btn = document.getElementById('submit-btn');

  formError.classList.add('hidden');
  formSuccess.classList.add('hidden');
  formError.textContent = '';
  formSuccess.textContent = '';

  const departureCityId = document.getElementById('departureCity').value;
  const destinationCityId = document.getElementById('destinationCity').value;
  const missionDate = document.getElementById('missionDate').value;
  const lunchSelected = document.getElementById('lunch').checked;
  const dinnerSelected = document.getElementById('dinner').checked;
  const comments = document.getElementById('comments').value.trim() || undefined;
  const colleagues = getSelectedColleagues();

  if (!departureCityId || !destinationCityId || !missionDate) {
    formError.textContent = 'Merci de compléter les champs obligatoires.';
    formError.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Capture GPS en cours...';

  try {
    // Rappel important: la capture GPS est exécutée avant l’envoi au backend.
    const { latitude, longitude } = await captureGps();

    btn.textContent = 'Soumission en cours...';

    const payload = {
      departureCityId,
      destinationCityId,
      missionDate,
      comments,
      submissionLat: latitude,
      submissionLon: longitude,
      lunchSelected,
      dinnerSelected,
      colleagues
    };

    await http.post('/api/travels', payload);

    formSuccess.textContent = 'Déclaration soumise avec succès.';
    formSuccess.classList.remove('hidden');
    await loadHistory();
  } catch (err) {
    formError.textContent = err.message || 'Erreur lors de la soumission.';
    formError.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = ensureAuthenticatedTechnician();
  if (!user) return;

  const nameEl = document.getElementById('tech-user-name');
  if (nameEl) {
    nameEl.textContent = user.fullName || user.username;
    nameEl.classList.remove('hidden');
  }

  setupLogout();
  setTodayAsDefaultDate();
  await Promise.all([loadCities(), loadColleagues(), loadHistory()]);

  document
    .getElementById('gps-refresh-btn')
    .addEventListener('click', () => captureGps().catch(() => {}));

  document
    .getElementById('travel-form')
    .addEventListener('submit', (e) => void handleSubmit(e));

  document
    .getElementById('refresh-history-btn')
    .addEventListener('click', () => loadHistory());
});

