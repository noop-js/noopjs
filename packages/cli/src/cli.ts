#!/usr/bin/env node

import { runCommand } from './index.js';

const command = process.argv[2] as any;
const args = process.argv.slice(3);
runCommand(command, args).catch((err) => {
  console.error(err);
  process.exit(1);
});
