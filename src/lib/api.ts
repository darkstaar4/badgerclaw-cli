import axios, { AxiosInstance } from 'axios';
import { readAuth } from './auth';

const BASE_URL = 'https://api.badgerclaw.ai';

export function getClient(): AxiosInstance {
  const auth = readAuth();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth) {
    headers['Authorization'] = `Bearer ${auth.access_token}`;
  }
  return axios.create({ baseURL: BASE_URL, headers });
}

export function getUnauthenticatedClient(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
  });
}
