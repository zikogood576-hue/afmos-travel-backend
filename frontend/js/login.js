import { http, setSession, clearSession, getCurrentUser } from './app/http.js';

function redirectAfterLogin(user) {
  if (!user) return;
  if (user.role === 'ADMIN') {
    window.location.href = 'admin.html';
  } else {
    window.location.href = 'technician.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const existing = getCurrentUser();
  if (existing) {
    redirectAfterLogin(existing);
    return;
  }

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    const username = document.getElementById('username').value.trim();
    const accessCode = document.getElementById('accessCode').value.trim();
    const remember = document.getElementById('remember').checked;

    if (!username || !accessCode) {
      errorEl.textContent = 'Merci de renseigner vos identifiants.';
      errorEl.classList.remove('hidden');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Connexion...';

    try {
      const data = await http.post('/api/auth/login', { username, accessCode });
      setSession(data, remember);
      redirectAfterLogin(data.user);
    } catch (err) {
      errorEl.textContent =
        err.status === 401
          ? 'Identifiant ou code incorrect.'
          : err.message || 'Erreur de connexion.';
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
});

