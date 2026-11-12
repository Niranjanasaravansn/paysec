import axios from 'axios';
const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((c) => { const t = localStorage.getItem('token'); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use((r) => r, (e) => {
  if (e.response?.status === 401 && !e.config.url.startsWith('/auth')) { localStorage.removeItem('token'); window.location.assign('/login'); }
  return Promise.reject(e);
});
export const errMsg = (e) => e.response?.data?.error || e.message || 'Something went wrong';
export const get = async (u, params) => (await api.get(u, { params })).data.data;
export const send = async (m, u, body) => (await api[m](u, body)).data.data;
export default api;
