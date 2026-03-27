import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import os from 'os';
import { generateCodeVerifier, generateCodeChallenge } from '../lib/pkce';
import { writeAuth, extractUsername } from '../lib/auth';
import { getUnauthenticatedClient } from '../lib/api';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120000;

export const loginCommand = new Command('login')
  .description('Log in to BadgerClaw via browser')
  .action(async () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);

    const authUrl = `https://api.badger.signout.io/cli-auth?code=${challenge}`;

    console.log(chalk.yellow('Opening browser for authentication...'));
    console.log(chalk.dim(`If the browser doesn't open, visit: ${authUrl}`));

    await open(authUrl);

    const spinner = ora('Waiting for authentication...').start();
    const client = getUnauthenticatedClient();
    const startTime = Date.now();

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      try {
        const response = await client.post('/cli-auth/poll', {
          code_verifier: verifier,
          code_challenge: challenge,
        });

        if (response.data?.access_token) {
          const { access_token, user_id, instance_id, expires_at } = response.data;

          writeAuth({ access_token, user_id, instance_id, expires_at });

          // Register instance
          try {
            const version = require('../../package.json').version;
            await client.post('/api/v1/openclaw/register', {
              instance_id,
              user_id,
              label: os.hostname(),
              version,
            }, {
              headers: { Authorization: `Bearer ${access_token}` },
            });
          } catch {
            // Non-fatal: registration may fail but login succeeded
          }

          spinner.succeed(chalk.green(`Logged in as ${extractUsername(user_id)}`));
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
