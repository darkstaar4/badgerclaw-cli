import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { isAuthenticated } from '../lib/auth';
import { getClient } from '../lib/api';

function requireAuth(): void {
  if (!isAuthenticated()) {
    console.log(chalk.red('Not logged in. Run `badgerclaw login` to authenticate.'));
    process.exit(1);
  }
}

function validateBotName(name: string): boolean {
  return /^[a-z0-9_]{4,20}$/.test(name);
}

function stripBotSuffix(name: string): string {
  return name.replace(/_bot$/, '');
}

const botCreate = new Command('create')
  .description('Create a new bot')
  .argument('<name>', 'Bot name (4-20 chars, lowercase alphanumeric + underscores)')
  .action(async (name: string) => {
    requireAuth();

    if (!validateBotName(name)) {
      console.log(chalk.red('Invalid bot name. Must be 4-20 characters, lowercase alphanumeric and underscores only.'));
      process.exit(1);
    }

    const spinner = ora(`Creating bot "${name}"...`).start();
    try {
      const client = getClient();
      await client.post('/api/v1/openclaw/bots', { username: name });
      spinner.succeed(chalk.green(`Bot "${name}" created successfully!`));
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      spinner.fail(chalk.red(`Failed to create bot: ${msg}`));
      process.exit(1);
    }
  });

const botList = new Command('list')
  .description('List your bots')
  .action(async () => {
    requireAuth();

    const spinner = ora('Fetching bots...').start();
    try {
      const client = getClient();
      const response = await client.get('/api/v1/openclaw/bots');
      const bots: any[] = response.data?.bots || [];
      spinner.stop();

      if (bots.length === 0) {
        console.log(chalk.yellow('No bots found. Create one with `badgerclaw bot create <name>`.'));
        return;
      }

      console.log(chalk.green(`Your bots (${bots.length}):\n`));
      for (const bot of bots) {
        const displayName = stripBotSuffix(bot.username || bot.name);
        const status = bot.active !== false ? chalk.green('active') : chalk.dim('inactive');
        console.log(`  ${chalk.bold(displayName)}  ${status}`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      spinner.fail(chalk.red(`Failed to list bots: ${msg}`));
      process.exit(1);
    }
  });

const botDelete = new Command('delete')
  .description('Deactivate a bot')
  .argument('<name>', 'Bot name to deactivate')
  .action(async (name: string) => {
    requireAuth();

    const spinner = ora(`Deactivating bot "${name}"...`).start();
    try {
      const client = getClient();
      await client.delete(`/api/v1/openclaw/bots/${name}`);
      spinner.succeed(chalk.green(`Bot "${name}" deactivated.`));
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      spinner.fail(chalk.red(`Failed to deactivate bot: ${msg}`));
      process.exit(1);
    }
  });

export const botCommand = new Command('bot')
  .description('Manage bots')
  .addCommand(botCreate)
  .addCommand(botList)
  .addCommand(botDelete);
