const path = require('path');
const { readFile } = require('fs').promises;

const { parseExpressionAt, parse } = require('acorn');
// eslint-disable-next-line no-unused-vars
const { assert } = require('chai');
const { green, yellow, magenta, gray } = require('chalk');

const { argMin } = require('./utils');
const log = require('./logger')();

const OPTIONS_ACORN = {
  allowImportExportEverywhere: false,
  allowReserved: true,
  allowReturnOutsideFunction: false,
  ecmaVersion: 10,
};

// const $float = () => Math.random() < 0.5 ? -1 : 1 * (Math.random() * Number.MAX_SAFE_INTEGER);
// const $int = () => Math.round($float());

/**
 * @param {string} s
 * @return {Array<{code: string, text: string}>}
 */
const getDocs = (s) => {
  const regex = /^\*\r?\n\s+\*\s+/;
  const comments = [];
  const options = {
    ...OPTIONS_ACORN,
    sourceType: 'module',
    onComment: ((isBlock, text, start, end) => {
      if (isBlock && text.search(regex) >= 0) {
        comments.push({ text, start, end });
      }
    }),
    allowHashBang: true,
  };
  const root = parse(s, options);
  return comments.map(({ end: commentEnd, text: commentText }) => {
    const { end: endCode } = argMin(
      root.body.filter(({ type }) => type.endsWith('Declaration')),
      ({ start: startCode }) => Math.abs(commentEnd - startCode),
    );
    return { code: s.slice(commentEnd, endCode).trim(), text: commentText.trim() };
  });
};

/**
 * @param {string} doc
 * @test {parseDoc(' * @name myTest')} ({ name: ['myTest'] })
 * @test {parseDoc(' * @test {some} thing')} ({ test: ['{some} thing'] })
 * @test {parseDoc('')} ({})
 * @test {parseDoc('@asdf')} ({})
 * @test {parseDoc(' * @asdf ')} ({})
 * @returns {Record<string, string[]>}
 */
const parseDoc = (doc) => {
  const dict = {};
  // eslint-disable-next-line security/detect-non-literal-regexp,no-control-regex
  const regex = new RegExp('[ ]+[*][ ]+@([-a-zA-Z0-9]+)[ ]+([^\n\r]*)', 'g');
  const match = doc.matchAll(regex);
  for (const m of match) {
    m[1] = (m[1] || '').trim();
    m[2] = (m[2] || '').trim();
    if (m[1] && m[2]) {
      const name = m[1];
      if (dict[name] === undefined) {
        dict[name] = [];
      }
      const value = m[2];
      dict[name].push(value.trim());
    }
  }
  return dict;
};


/**
 * @param {string} s
 * @return {Generator<{cases: Array<{expected: string, actual: string}>, code: string}>}
 */
const iterDocs = function* (s) {
  const docs = getDocs(s)
    .map(({ text, ...doc }) => ({ tags: parseDoc(text), ...doc }))
    .filter(({ tags }) => tags.test !== undefined);
  for (const { code, tags } of docs) {
    const cases = [];
    for (const testDoc of tags.test) {
      const firstVal = testDoc.slice(1);
      const astExpr = parseExpressionAt(firstVal, 0, { ...OPTIONS_ACORN, sourceType: 'script' });
      cases.push({
        expected: firstVal.slice(astExpr.end + 2),
        actual: firstVal.slice(astExpr.start, astExpr.end),
      });
    }
    yield { cases, code };
  }
};

/**
 * @param {string} file
 * @returns {Promise<boolean>}
 */
const run = async (file) => {
  log.log('');
  log.startTime('run');
  const p = path.resolve(file);
  const text = await readFile(p, { encoding: 'utf-8' });
  log.log(yellow(p));
  // eslint-disable-next-line no-unused-vars
  const docsIterator = iterDocs(text);
  eval(`${text};
    for (const { cases, code } of docsIterator) {
      log.log('');
      log.log(magenta.bold('TEST'));
      log.log('');
      log.log(gray(code));
      log.log('');
      for (const { expected, actual } of cases) {
        log.log(actual.padEnd(cases.reduce((prev, c) => Math.max(prev, c.actual.length), 10), ' ') + ' is ' + expected);
        assert.deepStrictEqual(eval(actual), eval(expected));
      }
    }
  `);
  log.log(green('\nPASS'));
  log.endTime('run');
  return true;
};

module.exports = run;
