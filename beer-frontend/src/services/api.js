import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 - redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const register = (data) =>
  api.post('/auth/register', data);

export const getMe = () =>
  api.get('/auth/me');

export const getUsers = () =>
  api.get('/auth/users');

// Participants
export const getParticipants = () =>
  api.get('/participants');

export const getParticipant = (id) =>
  api.get(`/participants/${id}`);

export const registerParticipant = (data) =>
  api.post('/participants', data);

// Batches
export const getBatches = () =>
  api.get('/batches');

export const getMyBatches = () =>
  api.get('/batches/my');

export const getBatch = (id) =>
  api.get(`/batches/${id}`);

export const getBatchHistory = (id) =>
  api.get(`/batches/${id}/history`);

export const createBatch = (data) =>
  api.post('/batches', data);

export const transferBatch = (batchId, toParticipantId) =>
  api.post(`/batches/${batchId}/transfer`, { toParticipantId });

export const recordSale = (batchId, quantitySold, saleInfo) =>
  api.post(`/batches/${batchId}/sale`, { quantitySold, saleInfo });

export default api;