import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import os from 'os';
import crypto from 'crypto';
import { generateCodeVerifier, generateCodeChallenge } from '../lib/pkce';
import { writeAuth, extractUsername } from '../lib/auth';
import { getUnauthenticatedClient } from '../lib/api';
import { runAutoPair } from './autopair';
import { spawn } from 'child_process';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120000;

export const loginCommand = new Command('login')
  .description('Log in to BadgerClaw via browser')
  .action(async () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);

    const authUrl = `https://badgerclaw.ai/cli-auth?code=${challenge}`;

    console.log(chalk.yellow('Opening browser for authentication...'));
    console.log(chalk.dim(`If the browser doesn't open, visit: ${authUrl}`));

    await open(authUrl);

    const spinner = ora('Waiting for authentication...').start();
    const client = getUnauthenticatedClient();
    const startTime = Date.now();

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      try {
        const response = await client.post(`/api/v1/openclaw/cli/auth/poll/${challenge}`, {
          code_verifier: verifier,
          code_challenge: challenge,
        });

        if (response.data?.access_token) {
          const { access_token, user_id, expires_at } = response.data;

          // Generate a stable instance_id from hostname + a machine fingerprint
          const machineId = crypto
            .createHash('sha256')
            .update(`${os.hostname()}-${os.platform()}-${os.arch()}`)
            .digest('hex')
            .slice(0, 16);
          const instance_id = `openclaw-${os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '-')}-${machineId}`;

          writeAuth({ access_token, user_id, instance_id, expires_at });

          // Register instance with backend so dashboard shows connected
          try {
            const { version } = require('../../package.json');
            await client.post('/api/v1/openclaw/register', {
              instance_id,
              label: os.hostname(),
              version,
            }, {
              headers: { Authorization: `Bearer ${access_token}` },
            });
          } catch {
            // Non-fatal: registration may fail but login succeeded
          }

          spinner.succeed(chalk.green(`Logged in as ${extractUsername(user_id)}`));

          // Auto-pair any bots pending right now
          const paired = await runAutoPair(true);
          if (paired > 0) {
            console.log(chalk.green(`✅ ${paired} bot(s) automatically paired to OpenClaw.`));
            console.log(chalk.yellow('Run: openclaw gateway restart to activate.'));
          }

          // Start background watch daemon so future pairs from the app are picked up automatically
          const self = process.argv[1];
          const watcher = spawn(process.execPath, [self, 'watch'], {
            detached: true,
            stdio: 'ignore',
          });
          watcher.unref();
          console.log(chalk.dim('Background pair-watcher started (picks up new pairs from the iOS app automatically).'));

          return;
        }
      } catch {
        // Not ready yet, keep polling
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    spinner.fail(chalk.red('Authentication timed out. Please try again.'));
    process.exit(1);
  });
