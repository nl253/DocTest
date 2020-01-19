#!/usr/bin/env node
const program = require('commander');

const { description, name, version } = require('../package.json');
const run = require('../src/lib.js');
const collectFiles = require('../src/collect-files.js');

program
  .version(version)
  .description(description)
  .name(name)
  .option('-v, --verbosity <n>', 'set logging threshold', (n) => parseInt(n), 1)
  .option('-n, --runs <n>', 'run tests n times', (n) => parseInt(n), 1)
  .option('-d, --doc-regex <r>', 'run tests whose docs match regex', ' @test ')
  .option('-D, --doc-ignore-regex <r>', 'run tests whose docs don\'t match regex', ' @notest ')
  .option('-c, --code-regex <r>', 'run tests whose code match regex', '.*')
  .option('-C, --code-ignore-regex <r>', 'run tests whose code don\'t match regex', '__x__x__x__')
  .option('-f, --file-regex <r>', 'run tests in files paths that match regex', '.*')
  .option('-F, --file-ignore-regex <r>', 'run tests in files that don\'t match regex', '__x__x__x__')
  .arguments('[files...]')
  .action(async (files, {
    verbosity,
    fileIgnoreRegex,
    fileRegex,
    docIgnoreRegex,
    docRegex,
    codeIgnoreRegex,
    codeRegex,
    runs,
  }) => {
    // eslint-disable-next-line global-require
    const log = require('../src/logger.js')(verbosity);
    log.debug({
      verbosity,
      fileIgnoreRegex,
      fileRegex,
      docIgnoreRegex,
      docRegex,
      codeIgnoreRegex,
      codeRegex,
      runs,
    });
    log.startTime('all');
    for await (const fPath of collectFiles(files.length === 0 ? ['.'] : files, { fileIgnoreRegex, fileRegex, log })) {
      try {
        for (let i = 0; i < runs; i++) {
          await run(fPath, {
            log,
            docIgnoreRegex,
            docRegex,
            codeRegex,
            codeIgnoreRegex,
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        log.error(e.message, e);
        return;
      }
    }
    log.info('');
    log.endTime('all');
  });

program.parse(process.argv);
