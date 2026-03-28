import { Command } from 'commander';
import chalk from 'chalk';
import { readAuth, clearAuth, extractUsername } from '../lib/auth';
import { getAuthenticatedClient } from '../lib/api';

export const logoutCommand = new Command('logout')
  .description('Disconnect this machine and log out of BadgerClaw')
  .action(async () => {
    const auth = readAuth();
    if (!auth) {
      console.log(chalk.yellow('Not logged in.'));
      return;
    }

    // Mark instance offline on backend
    try {
      const client = getAuthenticatedClient(auth.access_token);
      const { version } = require('../../package.json');
      await client.post('/api/v1/openclaw/register', {
        instance_id: auth.instance_id,
        label: require('os').hostname(),
        version,
        online: false,
      });
    } catch {
      // Non-fatal
    }

    clearAuth();
    console.log(chalk.green(`Logged out — this machine is now disconnected.`));
  });
