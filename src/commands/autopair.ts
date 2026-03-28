import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { readAuth } from '../lib/auth';
import { getAuthenticatedClient } from '../lib/api';

const OPENCLAW_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const API_BASE = 'https://api.badgerclaw.ai';

interface PendingPair {
  pair_code: string;
  bot_name: string;
  bot_user_id: string;
  expires_in: number;
}

interface RedeemResponse {
  homeserver: string;
  access_token: string;
  user_id: string;
  bot_name: string;
  device_id: string;
}

export async function redeemAndWrite(pairCode: string, botName: string, botUserId: string, silent: boolean): Promise<void> {
  const auth = readAuth();
  if (!auth) return;

  const spinner = silent ? null : ora(`Pairing bot: ${botName}...`).start();

  try {
    // Redeem the pair code to get Matrix credentials
    const redeemResp = await fetch(`${API_BASE}/api/v1/pairing/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: pairCode }),
    });

    if (!redeemResp.ok) {
      const err = await redeemResp.json().catch(() => ({ detail: redeemResp.statusText }));
      spinner?.fail(chalk.red(`Failed to redeem ${botName}: ${(err as any).detail || redeemResp.status}`));
      return;
    }

    const bot = await redeemResp.json() as RedeemResponse;

    // Write to OpenClaw config using `openclaw config set` — this triggers gateway hot-reload
    // (fs.writeFileSync doesn't; `openclaw config set` does)
    const { execSync } = await import('child_process');
    const localpart = bot.user_id.split(':')[0].replace('@', '').replace(/_bot$/, '');
    const base = `channels.badgerclaw.accounts.${localpart}`;
    execSync(`openclaw config set ${base}.userId "${bot.user_id}"`, { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' });
    execSync(`openclaw config set ${base}.accessToken "${bot.access_token}"`, { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' });
    execSync(`openclaw config set ${base}.homeserver "${bot.homeserver}"`, { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' });
    execSync(`openclaw config set ${base}.encryption true`, { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' });
    if (bot.device_id) {
      execSync(`openclaw config set ${base}.deviceId "${bot.device_id}"`, { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' });
    }

    // Mark as claimed
    await fetch(`${API_BASE}/api/v1/openclaw/pending-pairs/${pairCode}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.access_token}` },
    }).catch(() => {});

    spinner?.succeed(chalk.green(`✅ ${bot.bot_name} (${bot.user_id}) paired — bot is live!`));
  } catch (e: any) {
    spinner?.fail(chalk.red(`Failed to pair ${botName}: ${e.message}`));
  }
}

export async function runAutoPair(silent = false): Promise<number> {
  const auth = readAuth();
  if (!auth) return 0;

  const client = getAuthenticatedClient(auth.access_token);

  try {
    const { data: pending }: { data: PendingPair[] } = await client.get('/api/v1/openclaw/pending-pairs');
    if (!pending || pending.length === 0) return 0;

    let paired = 0;

    for (const pair of pending) {
      const spinner = silent ? null : ora(`Pairing bot: ${pair.bot_name} (${pair.bot_user_id})`).start();

      try {
        await redeemAndWrite(pair.pair_code, pair.bot_name, pair.bot_user_id, silent);

        // Mark as claimed (redeemAndWrite already does this, but do it here too for runAutoPair path)
        await client.post(`/api/v1/openclaw/pending-pairs/${pair.pair_code}/claim`).catch(() => {});

        paired++;
      } catch (e) {
        spinner?.fail(chalk.red(`Error pairing ${pair.bot_name}: ${e}`));
      }
    }

    if (paired > 0 && !silent) {
      console.log(chalk.yellow(`\n⚡ ${paired} bot(s) paired. Run: openclaw gateway restart`));
    }

    return paired;
  } catch {
    return 0;
  }
}

function writeToOpenClawConfig(bot: RedeemResponse): void {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8'));
  } catch {
    // config doesn't exist yet — that's fine
  }

  const channels = (config.channels as Record<string, unknown>) ?? {};
  const badgerclaw = (channels.badgerclaw as Record<string, unknown>) ?? {};
  const accounts = (badgerclaw.accounts as Record<string, unknown>) ?? {};

  // Derive key from localpart: @think_bot:... → "think"
  const localpart = bot.user_id.split(':')[0].replace('@', '').replace(/_bot$/, '');

  accounts[localpart] = {
    userId: bot.user_id,
    accessToken: bot.access_token,
    homeserver: bot.homeserver,
    encryption: true,
    deviceId: bot.device_id,
  };

  badgerclaw.accounts = accounts;
  channels.badgerclaw = badgerclaw;
  config.channels = channels;

  fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));
}

export const autopairCommand = new Command('autopair')
  .description('Check for pending bot pairs and connect them to OpenClaw automatically')
  .action(async () => {
    const auth = readAuth();
    if (!auth) {
      console.log(chalk.yellow('Not logged in. Run `badgerclaw login` first.'));
      return;
    }

    console.log(chalk.dim('Checking for pending bot pairs...'));
    const count = await runAutoPair(false);

    if (count === 0) {
      console.log(chalk.dim('No pending pairs found.'));
    }
  });
