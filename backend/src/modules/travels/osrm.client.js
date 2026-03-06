import { env } from '../../config/env.js';
import { badRequest } from '../../utils/errors.js';

export async function getDrivingDistanceKm({ from, to }) {
  const url = new URL(`${env.OSRM_BASE_URL.replace(/\/+$/, '')}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}`);
  url.searchParams.set('overview', 'false');
  url.searchParams.set('alternatives', 'false');
  url.searchParams.set('steps', 'false');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw badRequest("Impossible de calculer la distance (OSRM indisponible)", 'OSRM_ERROR');
    const data = await resp.json();
    const meters = data?.routes?.[0]?.distance;
    if (typeof meters !== 'number') throw badRequest('Distance OSRM invalide', 'OSRM_ERROR');
    return meters / 1000;
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw badRequest("Impossible de calculer la distance (timeout OSRM)", 'OSRM_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

