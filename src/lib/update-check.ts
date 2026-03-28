import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHECK_FILE = path.join(os.homedir(), '.badgerclaw', 'update-check.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day
const NPM_REGISTRY = 'https://registry.npmjs.org/badgerclaw/latest';

interface CheckCache {
  lastCheck: number;
  latestVersion: string;
}

function readCache(): CheckCache | null {
  try {
    return JSON.parse(fs.readFileSync(CHECK_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function writeCache(data: CheckCache): void {
  try {
    fs.mkdirSync(path.dirname(CHECK_FILE), { recursive: true });
    fs.writeFileSync(CHECK_FILE, JSON.stringify(data));
  } catch {}
}

function isNewerVersion(current: string, latest: string): boolean {
  const toNum = (v: string) => v.replace(/[^0-9.]/g, '').split('.').map(Number);
  const [cm, cmi, cp] = toNum(current);
  const [lm, lmi, lp] = toNum(latest);
  if (lm !== cm) return lm > cm;
  if (lmi !== cmi) return lmi > cmi;
  return lp > cp;
}

export async function checkForUpdates(currentVersion: string, silent = false): Promise<void> {
  try {
    const cache = readCache();
    const now = Date.now();

    // Use cached result if checked recently
    if (cache && now - cache.lastCheck < CHECK_INTERVAL_MS) {
      if (isNewerVersion(currentVersion, cache.latestVersion)) {
        printUpdateNotice(currentVersion, cache.latestVersion);
      }
      return;
    }

    // Fetch latest version from npm (non-blocking, short timeout)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(NPM_REGISTRY, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) return;
    const data = await resp.json() as { version: string };
    const latestVersion = data.version;

    writeCache({ lastCheck: now, latestVersion });

    if (isNewerVersion(currentVersion, latestVersion)) {
      printUpdateNotice(currentVersion, latestVersion);
    }
  } catch {
    // Totally silent — never break the CLI due to update check
  }
}

function printUpdateNotice(current: string, latest: string): void {
  console.log(
    chalk.yellow(`\n  ⚠️  Update available: badgerclaw ${chalk.dim(current)} → ${chalk.green(latest)}`) +
    chalk.dim(`\n  Run: `) + chalk.cyan(`npm install -g badgerclaw`) + '\n'
  );
}
