const path = require('path');
const { readFile } = require('fs').promises;

// noinspection JSUnusedLocalSymbols
// eslint-disable-next-line no-unused-vars
// @ts-ignore
// eslint-disable-next-line no-unused-vars
const { assert } = require('chai');
const { green, yellow } = require('chalk');
const Logger = require('./logger');

const log = new Logger();
const { iterDocs } = require('./utils');

/**
 * @param {string} file
 * @returns {Promise<void>}
 */
const run = async (file) => {
  const p = path.resolve(file);
  const text = await readFile(p, { encoding: 'utf-8' });
  const parts = [text];
  let nTests = 0;
  for (const { actual, expected, ...rest } of iterDocs(text)) {
    parts.push(`log.log(${JSON.stringify(actual.padEnd(55, ' '))}, 'is', ${JSON.stringify(expected)})`);
    parts.push(`assert.deepStrictEqual(${actual}, ${expected})`);
    nTests++;
  }
  if (parts.length > 1) {
    log.log(yellow(p));
    // eslint-disable-next-line no-eval
    eval(parts.join(';'));
    log.log(green(`\nPASS [${nTests}/${nTests}]`));
  } else {
    // eslint-disable-next-line no-throw-literal
    throw null;
  }
};

module.exports = run;
