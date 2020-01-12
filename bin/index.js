#!/usr/bin/env node
const program = require('commander');

const { description, name, version } = require('../package.json');
const run = require('../src/lib.js');
const Logger = require('../src/logger.js');
const { collectFiles } = require('../src/utils');

const log = new Logger(0);

program
  .version(version)
  .description(description)
  .name(name)
  .arguments('[files...]')
  .action(async (files) => {
    for await (const fPath of collectFiles(files.length === 0 ? ['.'] : files)) {
      try {
        log.startTime('run');
        await run(fPath);
        log.endTime('run');
        log.log('');
      } catch (e) {
        if (e !== null) {
          console.error(e);
          return;
        }
      }
    }
  });

program.parse(process.argv);
