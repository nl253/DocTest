/* eslint-disable no-continue */
const path = require('path');
const { readFile } = require('fs').promises;

const { parseExpressionAt, parse } = require('acorn');
// eslint-disable-next-line no-unused-vars
const { assert } = require('chai');
// eslint-disable-next-line no-unused-vars
const { green, yellow, magenta, gray, cyan } = require('chalk');

const { argMin } = require('./utils');
const log = require('./logger')();

const PARSE_DOC_REGEX = /^(\s+\*\s+@test\s+\{\s*)/m;
// noinspection JSUnusedLocalSymbols
const GET_DOCS_REGEX = /^\*\r?\n\s+\*\s+/;

/**
 * @notest
 * @param {string} s
 * @param {{docRegex: RegExp, docIgnoreRegex: RegExp}} opts
 * @return {Generator<{code: string, doc: string}>}
 */
const getDocs = function* (s, opts) {
  const comments = [];
  const options = {
    allowImportExportEverywhere: false,
    allowReserved: true,
    allowReturnOutsideFunction: false,
    preserveParens: true,
    ecmaVersion: 10,
    sourceType: 'module',
    onComment: ((isBlock, doc, start, end) => {
      if (isBlock && doc.search(GET_DOCS_REGEX) >= 0) {
        comments.push({ doc, start, end });
      }
    }),
    allowHashBang: true,
  };
  const root = parse(s, options);
  for (const { end: commentEnd, doc: commentText } of comments) {
    if (commentText.search(opts.docRegex) >= 0 && commentText.search(opts.docIgnoreRegex) < 0) {
      const { end: endCode } = argMin(
        root.body.filter(({ type }) => type.endsWith('Declaration')),
        ({ start: startCode }) => Math.abs(commentEnd - startCode),
      );
      yield {
        code: s.slice(commentEnd, endCode).trim(),
        doc: commentText.trim(),
      };
    }
  }
};

/**
 * @test {parseDoc(' * @test {woo} myTest').next().value} ({ left: 'woo', right: 'myTest' })
 * @test {parseDoc(' * @test {some} thing').next().value} ({ left: 'some', right: 'thing' })
 * @test {parseDoc('').next().value} undefined
 * @test {parseDoc('@asdf').next().value} undefined
 * @test {parseDoc(' * @asdf ').next().value} undefined
 * @param {string} doc
 * @returns {Generator<{ left: string, right: string }>}
 */
const parseDoc = function* (doc) {
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
 * @param {{codeRegex: RegExp, codeIgnoreRegex: RegExp, docRegex: RegExp, docIgnoreRegex: RegExp}} opts
 * @return {Generator<{cases: Generator<{left: *, right: *}>, code: string}>}
 */
const iterDocs = function* (s, opts) {
  for (const { doc, code } of getDocs(s, opts)) {
    if (code.search(opts.codeRegex) >= 0 && code.search(opts.codeIgnoreRegex) < 0) {
      yield { cases: parseDoc(doc), code };
    }
  }
};

/**
 * @notest
 * @param {string} file
 * @param {{codeRegex, codeIgnoreRegex, docRegex, docIgnoreRegex}} opts
 * @returns {Promise<boolean>}
 */
const run = async (file, opts) => {
  log.log('');
  log.startTime('run');
  const p = path.resolve(file);
  const text = await readFile(p, { encoding: 'utf-8' });
  log.log(yellow.underline(path.relative(process.cwd(), p)));
  // eslint-disable-next-line no-unused-vars
  const docsIterator = iterDocs(text, opts);
  // eslint-disable-next-line no-eval
  eval(`${text};
    for (const { cases, code } of docsIterator) {
      log.log('');
      log.log(magenta.bold('TEST') + ' ' + gray(code.replace(/^/m, '  ').trimLeft()));
      log.log('');
      let i = 0;
      for (const { left, right } of cases) {
        try {
          assert.deepStrictEqual(eval(left), eval(right));
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
  log.log(green('\nPASS'));
  log.endTime('run');
  return true;
};

module.exports = run;
