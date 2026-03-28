import { Command } from 'commander';
import chalk from 'chalk';
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const OPENCLAW_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const STASH_PATH = OPENCLAW_CONFIG + '.badgerclaw-stash';

function stashBadgerclawConfig(): object | null {
  if (!fs.existsSync(OPENCLAW_CONFIG)) return null;
  try {
    const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8'));
    const bc = config.channels?.badgerclaw;
    if (!bc) return null;
    // Remove from config temporarily
    delete config.channels.badgerclaw;
    // Also remove stale plugins entry
    if (config.plugins?.entries?.badgerclaw) delete config.plugins.entries.badgerclaw;
    fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));
    fs.writeFileSync(STASH_PATH, JSON.stringify(bc, null, 2));
    return bc;
  } catch {
    return null;
  }
}

function restoreBadgerclawConfig(): void {
  if (!fs.existsSync(STASH_PATH)) return;
  try {
    const stashed = JSON.parse(fs.readFileSync(STASH_PATH, 'utf-8'));
    const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8'));
    config.channels = config.channels || {};
    config.channels.badgerclaw = stashed;
    fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));
    fs.unlinkSync(STASH_PATH);
  } catch (e: any) {
    console.log(chalk.yellow(`  ⚠️  Could not restore config: ${e.message}`));
    console.log(chalk.yellow(`  Your bot credentials are backed up at: ${STASH_PATH}`));
  }
}

export const setupCommand = new Command('setup')
  .description('Install or update the OpenClaw BadgerClaw plugin safely (handles config automatically)')
  .action(async () => {
    console.log(chalk.green('\n🦡 BadgerClaw Setup\n'));

    // Step 1: Stash existing badgerclaw config if present
    const stashed = stashBadgerclawConfig();
    if (stashed) {
      console.log(chalk.dim('  Existing bot config stashed temporarily...'));
    }

    // Step 2: Install plugin
    console.log(chalk.dim('  Installing @badgerclaw/connect plugin...'));
    const result = spawnSync(
      'openclaw',
      ['plugins', 'install', '@badgerclaw/connect'],
      { stdio: 'inherit', shell: true }
    );

    // Step 3: Always restore config, even if install failed
    if (stashed) {
      restoreBadgerclawConfig();
      console.log(chalk.dim('  Bot config restored.'));
    }

    if (result.status !== 0) {
      console.log(chalk.red('\n❌ Plugin install failed. Your bot config has been restored.'));
      process.exit(1);
    }

    console.log(chalk.green('\n✅ BadgerClaw plugin installed successfully!'));
    console.log(chalk.dim('\nNext: run `badgerclaw login` to authenticate.'));
  });
