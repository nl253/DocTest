#!/usr/bin/env node
const program = require('commander');

const { description, name, version } = require('../package.json');
const run = require('../src/lib.js');
const collectFiles = require('../src/collect-files.js');
const log = require('../src/logger.js')();

program
  .version(version)
  .description(description)
  .name(name)
  .arguments('[files...]')
  .action(async (files) => {
    log.startTime('all');
    for await (const fPath of collectFiles(files.length === 0 ? ['.'] : files)) {
      try {
        await run(fPath);
      } catch (e) {
        console.error(e);
        return;
      }
    }
    log.endTime('all');
  });

program.parse(process.argv);
