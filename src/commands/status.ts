import { Command } from 'commander';
import chalk from 'chalk';
import { readAuth, isAuthenticated, extractUsername } from '../lib/auth';
import { checkForUpdates } from '../lib/update-check';

export const statusCommand = new Command('status')
  .description('Show connected instance info')
  .action(async () => {
    const { version } = require('../../package.json');
    await checkForUpdates(version);

    const auth = readAuth();

    if (!auth || !isAuthenticated()) {
      console.log(chalk.red('Not logged in. Run `badgerclaw login` to authenticate.'));
      process.exit(1);
    }

    console.log(chalk.green('Authenticated'));
    console.log(`  User:     ${extractUsername(auth.user_id)}`);
    console.log(`  Instance: ${auth.instance_id}`);
    console.log(`  Expires:  ${new Date(auth.expires_at).toLocaleDateString()}`);
  });
