import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AuthData {
  access_token: string;
  user_id: string;
  instance_id: string;
  expires_at: string;
}

const AUTH_DIR = path.join(os.homedir(), '.badgerclaw');
const AUTH_FILE = path.join(AUTH_DIR, 'auth.json');

export function readAuth(): AuthData | null {
  try {
    const data = fs.readFileSync(AUTH_FILE, 'utf-8');
    return JSON.parse(data) as AuthData;
  } catch {
    return null;
  }
}

export function writeAuth(auth: AuthData): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

export function clearAuth(): void {
  try {
    fs.unlinkSync(AUTH_FILE);
  } catch {
    // ignore
  }
}

export function isAuthenticated(): boolean {
  const auth = readAuth();
  if (!auth) return false;
  return new Date(auth.expires_at) > new Date();
}

export function extractUsername(userId: string): string {
  // Strip @user:homeserver to just "user"
  const match = userId.match(/^@?([^:]+)/);
  return match ? match[1] : userId;
}
