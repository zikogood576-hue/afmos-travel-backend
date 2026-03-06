import { http, getCurrentUser, clearSession } from './app/http.js';

function ensureAuthenticatedAdmin() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  if (user.role !== 'ADMIN') {
    window.location.href = 'technician.html';
    return null;
  }
  return user;
}

function setupLogout() {
  const btn = document.getElementById('logout-btn');
  btn.addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });
}

function renderKpis(kpi) {
  document.getElementById('kpi-today-count').textContent = kpi.todayCount ?? '–';
  document.getElementById('kpi-pending-count').textContent = kpi.pendingCount ?? '–';
  document.getElementById('kpi-suspicious-count').textContent = kpi.suspiciousCount ?? '–';
  document.getElementById('kpi-total-amount').textContent =
    (kpi.totalAmountMad ?? 0).toFixed ? kpi.totalAmountMad.toFixed(0) : kpi.totalAmountMad ?? '–';
}

async function loadDashboard() {
  try {
    // Suppose un endpoint /api/admin/dashboard
    const data = await http.get('/api/admin/dashboard');
    renderKpis(data);
  } catch (err) {
    console.error('Erreur dashboard', err);
  }
}

function buildStatusBadge(status, isSuspicious) {
  if (isSuspicious) return '<span class="badge-status-suspicious">Suspicious</span>';
  switch (status) {
    case 'APPROVED':
      return '<span class="badge-status-approved">Approuvée</span>';
    case 'REJECTED':
      return '<span class="badge-status-rejected">Rejetée</span>';
    case 'PENDING_VALIDATION':
      return '<span class="badge-status-pending">En attente</span>';
    default:
      return '<span class="badge-status">—</span>';
  }
}

async function loadPending() {
  const tbody = document.getElementById('pending-body');
  tbody.innerHTML = '';
  try {
    // Suppose /api/admin/travels/pending
    const data = await http.get('/api/admin/travels/pending');
    const items = data.items || [];
    if (!items.length) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td colspan="6" class="px-3 py-3 text-center text-xs text-slate-500">Aucune déclaration en attente.</td>';
      tbody.appendChild(tr);
      return;
    }

    for (const t of items) {
      const tr = document.createElement('tr');
      const meals =
        (t.lunch_selected ? 'Déj ' : '') + (t.dinner_selected ? 'Dîn' : '') || '-';
      const statusBadge = buildStatusBadge(t.status, t.is_suspicious);
      tr.innerHTML = `
        <td class="px-3 py-2 whitespace-nowrap">${t.employee_name || '-'}</td>
        <td class="px-3 py-2 whitespace-nowrap">${t.departure_city_name || ''} → ${
        t.destination_city_name || ''
      }</td>
        <td class="px-3 py-2">${t.distance_km ? t.distance_km.toFixed(1) + ' km' : '-'}</td>
        <td class="px-3 py-2">${meals}</td>
        <td class="px-3 py-2">${t.total_amount_mad ? t.total_amount_mad.toFixed(2) : '0.00'} MAD</td>
        <td class="px-3 py-2 space-x-2">
          <button data-id="${t.id}" data-action="approve" class="btn-primary px-2 py-1 text-xs">Valider</button>
          <button data-id="${t.id}" data-action="reject" class="btn-ghost px-2 py-1 text-xs text-rose-600">Rejeter</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error('Erreur chargement pending', err);
  }
}

async function loadSuspicious() {
  const container = document.getElementById('suspicious-list');
  container.innerHTML = '';
  try {
    // Suppose /api/admin/travels/suspicious
    const data = await http.get('/api/admin/travels/suspicious');
    const items = data.items || [];
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'text-xs text-slate-500';
      p.textContent = 'Aucune alerte de fraude.';
      container.appendChild(p);
      return;
    }

    for (const a of items) {
      const div = document.createElement('div');
      div.className =
        'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800';
      div.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-semibold">Alerte ${a.alert_type || 'Fraude'}</span>
          <span class="badge-status-suspicious text-[10px] uppercase">Suspicious</span>
        </div>
        <div class="mt-1">
          ${a.description || ''}
        </div>
        <div class="mt-1 text-[10px] text-red-700/80">
          Employé: ${a.employee_name || '-'} • Trajet: ${a.departure_city_name || ''} → ${
        a.destination_city_name || ''
      }
        </div>
      `;
      container.appendChild(div);
    }
  } catch (err) {
    console.error('Erreur chargement suspicious', err);
  }
}

function setupPendingActions() {
  const tbody = document.getElementById('pending-body');
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (!id) return;

    try {
      if (action === 'approve') {
        await http.post(`/api/admin/travels/${id}/approve`, {});
      } else if (action === 'reject') {
        const reason = prompt('Motif du rejet :');
        if (!reason) return;
        await http.post(`/api/admin/travels/${id}/reject`, { reason });
      }
      await Promise.all([loadPending(), loadSuspicious(), loadDashboard()]);
    } catch (err) {
      alert(err.message || 'Erreur lors de l\'action.');
    }
  });
}

function setupExports() {
  const container = document.querySelector('section .card');
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-export]');
    if (!btn) return;
    const period = btn.dataset.export;
    try {
      const url = `/api/admin/exports?period=${encodeURIComponent(period)}`;
      // Téléchargement simple via ouverture de lien
      window.location.href = `http://localhost:3001${url}`;
    } catch (err) {
      console.error('Erreur export', err);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = ensureAuthenticatedAdmin();
  if (!user) return;

  const nameEl = document.getElementById('admin-user-name');
  if (nameEl) {
    nameEl.textContent = user.fullName || user.username;
    nameEl.classList.remove('hidden');
  }

  setupLogout();
  setupPendingActions();
  setupExports();

  document
    .getElementById('refresh-pending-btn')
    .addEventListener('click', () => loadPending());
  document
    .getElementById('refresh-suspicious-btn')
    .addEventListener('click', () => loadSuspicious());

  await Promise.all([loadDashboard(), loadPending(), loadSuspicious()]);
});

