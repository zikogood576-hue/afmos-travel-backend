# Backend AFMOS — Phase 2 (API)

## Installation

```bash
cd backend
npm install
```

## Configuration

1) Copier `.env.example` vers `.env` puis renseigner:
- `DATABASE_URL` (connexion Postgres Supabase)
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

2) Créer les tables dans Supabase en exécutant:
- `sql/001_schema.sql`

3) Remplir `cities` avec les villes du Maroc (nom + lat/lon).

## Démarrage

```bash
npm run dev
```

## Endpoints (actuels)

- `GET /health`
- `POST /api/auth/login`
  - body: `{ "username": "tech1", "accessCode": "1234" }`
- `POST /api/travels` (TECHNICIAN)
  - Crée et soumet une déclaration (Pending validation)
  - body (exemple):
    ```json
    {
      "departureCityId": "uuid",
      "destinationCityId": "uuid",
      "missionDate": "2026-03-06",
      "submissionLat": 33.589886,
      "submissionLon": -7.603869,
      "lunchSelected": true,
      "dinnerSelected": false,
      "colleagues": [
        { "userId": "uuid", "lunchSelected": true, "dinnerSelected": true }
      ]
    }
    ```
- `GET /api/activity-logs` (ADMIN)

