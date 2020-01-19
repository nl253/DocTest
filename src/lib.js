/* eslint-disable no-continue */
const path = require('path');
const { readFile } = require('fs').promises;

/**
 * @typedef Logger
 * @property {function(...string)} warn
 * @property {function(...string)} error
 * @property {function(...string)} info
 * @property {function(...string)} log
 * @property {function(string): void} timeEnd
 * @property {function(string): void} timeStart
 */

const { parseExpressionAt, parse } = require('acorn');
// eslint-disable-next-line no-unused-vars
const { assert } = require('chai');
// eslint-disable-next-line no-unused-vars
const { green, yellow, magenta, gray, cyan, red } = require('chalk');

const { argMin } = require('./utils');

const PARSE_DOC_REGEX = /^(\s+\*\s+@test\s+\{\s*)/m;
// noinspection JSUnusedLocalSymbols
const GET_DOCS_REGEX = /^\*\r?\n\s+\*\s+/;

/**
 * @notest
 * @param {string} s
 * @param {{docRegex: string, docIgnoreRegex: string}} opts
 * @return {Generator<{code: string, doc: string}>}
 */
const getDocs = function* (s, { docIgnoreRegex, docRegex, log }) {
  const comments = [];
  const options = {
    allowImportExportEverywhere: false,
    allowReserved: true,
    allowReturnOutsideFunction: false,
    preserveParens: true,
    ecmaVersion: 10,
    sourceType: 'module',
    onComment: ((isBlock, doc, start, end) => {
      if (isBlock) {
        if ((doc.search(GET_DOCS_REGEX) >= 0) && (doc.search(docRegex) >= 0) && (doc.search(docIgnoreRegex) < 0)) {
          log.debug(`doc ${JSON.stringify(doc.slice(0, 40))}... added`);
          comments.push({ doc, start, end });
        } else {
          log.debug(`doc ${JSON.stringify(doc.slice(0, 40))}... filtered out`);
        }
      }
    }),
    allowHashBang: true,
  };
  const root = parse(s, options);
  for (const { end: commentEnd, doc: commentText } of comments) {
    const { end: endCode } = argMin(
      root.body.filter(({ type }) => type.endsWith('Declaration')),
      ({ start: startCode }) => Math.abs(commentEnd - startCode),
    );
    const code = s.slice(commentEnd, endCode).trim();
    log.debug(`\nfound code ${JSON.stringify(code.slice(0, 40))}... for doc ${JSON.stringify(commentText.trim().slice(0, 40))}...`);
    yield { code, doc: commentText.trim() };
  }
};

/**
 * @test {parseDoc(' * @test {woo} myTest', { error: () => null }).next().value} ({ left: 'woo', right: 'myTest' })
 * @test {parseDoc(' * @test {some} thing', { error: () => null }).next().value} ({ left: 'some', right: 'thing' })
 * @test {parseDoc('', { error: () => null }).next().value} undefined
 * @test {parseDoc('@asdf', { error: () => null }).next().value} undefined
 * @test {parseDoc(' * @asdf ', { error: () => null }).next().value} undefined
 * @param {string} doc
 * @param {{log: Logger}} opts
 * @returns {Generator<{ left: string, right: string }>}
 */
const parseDoc = function* (doc, { log }) {
  // noinspection JSUnusedLocalSymbols
  // eslint-disable-next-line security/detect-non-literal-regexp,no-control-regex
  let ptr = 0;
  // noinspection JSUnusedLocalSymbols
  let idx;
  let m;
  while (true) {
    idx = doc.slice(ptr).search(PARSE_DOC_REGEX);
    if (idx < 0) {
      break;
    }
    m = doc.slice(ptr).match(PARSE_DOC_REGEX);
    ptr += idx + m[1].length;
    let left;
    try {
      left = parseExpressionAt(doc, ptr);
    } catch (e) {
      log.error('parsing left', doc.slice(ptr));
      throw e;
    }
    ptr += left.end - left.start;
    while (doc[ptr].search(/\s/) >= 0) ptr++;
    ptr++;
    while (doc[ptr].search(/\s/) >= 0) ptr++;
    let right;
    try {
      right = parseExpressionAt(doc.slice(0, ptr + doc.slice(ptr).search(/\n|$/)), ptr);
    } catch (e) {
      log.error('left', doc.slice(left.start, left.end));
      log.error('parsing right', doc.slice(ptr));
      throw e;
    }
    ptr += right.end - right.start;
    const result = {
      left: doc.slice(left.start, left.end),
      right: doc.slice(right.start, right.end),
    };
    if (result.left.startsWith('{') && result.left.endsWith('}')) {
      result.left = `(${result.left})`;
    }
    if (result.right.startsWith('{') && result.right.endsWith('}')) {
      result.right = `(${result.right})`;
    }
    yield result;
  }
};


/**
 * @notest
 * @param {string} s
 * @param {{codeRegex: string, codeIgnoreRegex: string, docRegex: string, docIgnoreRegex: string, log: Logger}} opts
 * @return {Generator<{cases: Generator<{left: *, right: *}>, code: string}>}
 */
const iterDocs = function* (s, { codeIgnoreRegex, codeRegex, docIgnoreRegex, docRegex, log }) {
  for (const { doc, code } of getDocs(s, { docIgnoreRegex, docRegex, log })) {
    if (code.search(codeRegex) >= 0 && code.search(codeIgnoreRegex) < 0) {
      yield { cases: parseDoc(doc, { log }), code };
    } else {
      log.debug(`code ${code.slice(0, 20)}... filtered out`);
    }
  }
};

/**
 * @notest
 * @param {string} file
 * @param {{codeRegex: string, codeIgnoreRegex: string, docRegex: string, docIgnoreRegex: string, log: Logger}} opts
 * @returns {Promise<boolean>}
 */
const run = async (file, { log, codeIgnoreRegex, codeRegex, docIgnoreRegex, docRegex }) => {
  log.log('');
  log.startTime('run');
  const p = path.resolve(file);
  log.debug(`running doctests in ${file}`);
  const text = await readFile(p, { encoding: 'utf-8' });
  log.debug(`read ${text.length} bytes from ${p}`);
  log.log(`${yellow.bold('FILE')} ${path.relative(process.cwd(), p)}`);
  // eslint-disable-next-line no-unused-vars
  const docsIterator = iterDocs(text, { codeIgnoreRegex, codeRegex, docRegex, docIgnoreRegex, log });
  // eslint-disable-next-line no-eval
  let testsPresent = false;
  eval(`
    ${text};
    for (const { cases, code } of docsIterator) {
      log.log('');
      log.log(magenta.bold('TEST') + ' ' + gray(code.replace(/^/m, '  ').trimLeft()));
      log.log('');
      let i = 0;
      for (const { left, right } of cases) {
        testsPresent = true;
        try {
          log.startTime('case');
          assert.deepStrictEqual(eval(left), eval(right));
          log.startTime('case');
        } catch (e) {
          log.error('left ', left);
          log.error('right', right);
          throw e;
        }
        log.log(cyan('case #' + (++i).toString()) + ' assert ' + green(left.padEnd(50, ' ')));
        log.log('        is     ' + green(right));
      }
      if (i === 0) {
        log.warn('no tests');
      }
    }
  `);
  if (testsPresent) {
    log.log(green('\nPASS'));
    log.endTime('run');
  } else {
    log.info(red('\nNO TESTS'));
  }
  return true;
};

module.exports = run;
