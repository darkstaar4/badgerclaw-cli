#!/usr/bin/env node

import { Command } from 'commander';
import { loginCommand } from './commands/login';
import { logoutCommand } from './commands/logout';
import { statusCommand } from './commands/status';
import { botCommand } from './commands/bot';
import { autopairCommand } from './commands/autopair';
import { watchCommand } from './commands/watch';
import { setupCommand } from './commands/setup';

const program = new Command();

program
  .name('badgerclaw')
  .description('BadgerClaw CLI — one-click bot provisioning')
  .version(require('../package.json').version);

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(statusCommand);
program.addCommand(botCommand);
program.addCommand(autopairCommand);
program.addCommand(watchCommand);
program.addCommand(setupCommand);

program.parse(process.argv);
