const API_BASE_URL = window.AF_API_BASE_URL || 'https://afmos-travel-backend.onrender.com';
const TOKEN_KEY = 'afmos_token';
const USER_KEY  = 'afmos_user';

// Pages qui ne doivent PAS être redirigées (elles gèrent elles-mêmes l'auth)
const AUTH_PAGES = ['index.html', '/'];

function isAuthPage() {
  const path = window.location.pathname;
  return AUTH_PAGES.some(p => path.endsWith(p)) || path === '/';
}

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY) || window.sessionStorage.getItem(TOKEN_KEY);
}

export function setSession({ token, user }, remember) {
  const storage = remember ? window.localStorage : window.sessionStorage;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  [window.localStorage, window.sessionStorage].forEach((s) => {
    s.removeItem(TOKEN_KEY);
    s.removeItem(USER_KEY);
  });
}

export function getCurrentUser() {
  const raw =
    window.localStorage.getItem(USER_KEY) || window.sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function request(path, { method = 'GET', body, headers = {}, isFormData = false } = {}) {
  const token = getToken();
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const finalHeaders = { ...headers };
  if (!isFormData) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const message = data?.error?.message || data?.message || 'Erreur serveur';
      const code = data?.error?.code || 'HTTP_ERROR';

      // ✅ CORRECTION : ne rediriger que si on n'est PAS déjà sur la page de login
      // Évite la boucle infinie "401 → redirect index.html → 401 → ..."
      if (res.status === 401 && !isAuthPage()) {
        clearSession();
        window.location.href = 'index.html';
        return; // Stop l'exécution
      }

      const error = new Error(message);
      error.status = res.status;
      error.code = code;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export const http = {
  get:  (path)        => request(path, { method: 'GET' }),
  post: (path, body, options = {}) => request(path, { method: 'POST', body, ...options }),
  put:  (path, body)  => request(path, { method: 'PUT', body }),
  del:  (path)        => request(path, { method: 'DELETE' })
};