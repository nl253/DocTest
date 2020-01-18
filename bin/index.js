#!/usr/bin/env node
const program = require('commander');

const { description, name, version } = require('../package.json');
const run = require('../src/lib.js');
const collectFiles = require('../src/collect-files.js');

program
  .version(version)
  .description(description)
  .name(name)
  .option('-v, --verbosity <n>', 'set logging threshold', n => parseInt(n), 1)
  .option('-n, --runs <n>', 'run tests n times', n => parseInt(n), 1)
  .option('-d, --doc-regex <r>', 'run tests whose docs match regex', r => new RegExp(r), ' @test ')
  .option('-D, --doc-ignore-regex <r>', 'run tests whose docs don\'t match regex', r => new RegExp(r), ' @notest ')
  .option('-c, --code-regex <r>', 'run tests whose code match regex', r => new RegExp(r), '.*')
  .option('-C, --code-ignore-regex <r>', 'run tests whose code don\'t match regex', r => new RegExp(r), '__x__x__x__')
  .option('-f, --file-regex <r>', 'run tests in files paths that match regex', r => new RegExp(r), '.*')
  .option('-F, --file-ignore-regex <r>', 'run tests in files that don\'t match regex', r => new RegExp(r), '__x__x__x__')
  .arguments('[files...]')
  .action(async (files, opts) => {
    const log = require('../src/logger.js')(opts.verbosity);
    log.startTime('all');
    for await (const fPath of collectFiles(files.length === 0 ? ['.'] : files, opts)) {
      try {
        for (let i = 0; i < opts.runs; i++) {
          await run(fPath, opts);
        }
      } catch (e) {
        console.error(e);
        return;
      }
    }
    log.endTime('all');
  });

program.parse(process.argv);
