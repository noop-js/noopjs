#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, '../dist/cli.js');

import(entry).then(mod => mod.runCommand(process.argv[2], process.argv.slice(3)))
  .catch(err => { console.error(err); process.exit(1); });
