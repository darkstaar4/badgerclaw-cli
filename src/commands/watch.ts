import { Command } from 'commander';
import chalk from 'chalk';
import { readAuth } from '../lib/auth';
import { runAutoPair } from './autopair';

const POLL_INTERVAL_MS = 10_000;

export const watchCommand = new Command('watch')
  .description('Watch for pending bot pairs and connect them automatically (runs until stopped)')
  .action(async () => {
    const auth = readAuth();
    if (!auth) {
      console.log(chalk.yellow('Not logged in. Run `badgerclaw login` first.'));
      process.exit(1);
    }

    console.log(chalk.green('👀 Watching for pending bot pairs... (Ctrl+C to stop)'));
    console.log(chalk.dim(`Polling every ${POLL_INTERVAL_MS / 1000}s`));

    // Run once immediately
    await runAutoPair(false);

    // Then poll on interval
    setInterval(async () => {
      await runAutoPair(false);
    }, POLL_INTERVAL_MS);
  });
