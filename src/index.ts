#!/usr/bin/env node

import { Command } from 'commander';
import { loginCommand } from './commands/login';
import { statusCommand } from './commands/status';
import { botCommand } from './commands/bot';

const program = new Command();

program
  .name('badgerclaw')
  .description('BadgerClaw CLI — one-click bot provisioning')
  .version(require('../package.json').version);

program.addCommand(loginCommand);
program.addCommand(statusCommand);
program.addCommand(botCommand);

program.parse(process.argv);
