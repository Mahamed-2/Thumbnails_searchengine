// =============================================================================
// src/lib/api.ts — Axios HTTP Client
// Pre-configured to point to the backend API via Vite proxy
// =============================================================================

import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for consistent error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error?.message || error.message || 'An unknown error occurred';
    return Promise.reject(new Error(message));
  }
);
