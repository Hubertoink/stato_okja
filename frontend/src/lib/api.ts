import axios from 'axios';

// Allow overriding the API base URL at build time via Vite env (VITE_API_BASE_URL)
// Fallback to '/api' which works when the frontend's nginx proxies /api to the backend
const BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env?.VITE_API_BASE_URL) || '/api';

export const api = axios.create({
  baseURL: BASE_URL,
});

export function setAuthToken(token?: string) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}
