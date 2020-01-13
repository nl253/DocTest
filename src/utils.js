const { lstat, readdir } = require('fs').promises;
const { join, resolve, basename } = require('path');
const { parseExpressionAt, parse } = require('acorn');

const ignorePatterns = [
  '.git',
  '.history',
  '.hg',
  '.cache',
  '.backup',
  '.bak',
  '.svn',
  'bower_modules',
  'node_modules',
  'test',
];

const OPTIONS_ACORN = {
  ecmaVersion: 10,
  allowReturnOutsideFunction: false,
  allowReserved: true,
  allowImportExportEverywhere: false,
};

/**
 * @param {string} text
 * @return {string[]}
 */
const getDocs = (text) => {
  const regex = /^\*\n\s+\*\s+/;
  const comments = [];
  const options = {
    ...OPTIONS_ACORN,
    sourceType: 'module',
    onComment: ((isBlock, comment) => {
      if (isBlock && comment.search(regex) >= 0) {
        comments.push(comment);
      }
    }),
    allowHashBang: true,
  };
  parse(text, options);
  return comments;
};

/**
 * @param {string} doc
 * @test {parseDoc(' * @test {some} thing')} { test: ['{some} thing'] }
 * @test {parseDoc(' * @name myTest')} { name: ['myTest'] }
 * @test {parseDoc('')} {}
 * @test {parseDoc('@asdf')} {}
 * @test {parseDoc(' * @asdf ')} {}
 * @returns {Record<string, string[]>}
 */
const parseDoc = (doc) => {
  const dict = {};
  const regex = new RegExp(`[ ]+[*][ ]+@([-a-zA-Z0-9]+)[ ]+([^\n\r]*)`, 'g');
  const match = doc.matchAll(regex);
  for (const m of match) {
    m[1] = (m[1] || '').trim();
    m[2] = (m[2] || '').trim();
    if (m[1] && m[2]) {
      let name = m[1];
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
 * @param {string} text
 * @return {Generator<{expected: string, actual: string}>}
 */
const iterDocs = function* (text) {
  const cases = getDocs(text).map((doc) => parseDoc(doc)).filter(({ test }) => test !== undefined);
  for (const testCase of cases) {
    for (const t of testCase.test) {
      let c = t.slice(1);
      const astGiven = parseExpressionAt(c, 0, { ...OPTIONS_ACORN, sourceType: 'script' });
      const actual = c.slice(astGiven.start, astGiven.end);
      c = c.slice(astGiven.end + 2);
      const expectAst = parseExpressionAt(c, 0, { ...OPTIONS_ACORN, sourceType: 'script' });
      const expected = c.slice(expectAst.start, expectAst.end);
      yield { actual, expected, ...Object.fromEntries(Object.entries(testCase).map(([k, v]) => [k, v.join(', ')])) };
    }
  }
};

/**
 * @param {string} n
 * @test {filterFn('./node_modules/some-file.js')} false
 * @test {filterFn('script.ts')} true
 * @test {filterFn('otherScript.js')} true
 * @return {boolean}
 */
const notIgnoredFn = (n) => ignorePatterns.reduce((ok, pat) => ok && (n.indexOf(pat) < 0), true);

/**
 * @param {string} n
 * @test {filterFn('README.md')} false
 * @test {filterFn('my-directory')} true
 * @test {filterFn('special.ts')} true
 * @test {filterFn('woo.js')} true
 * @return {boolean}
 */
const isValidFileOrDir = (n) => (n.search(/\.[jt]s$/i) >= 0 || basename(n).indexOf('.') < 0);

/**
 * @param {string} n
 * @return {boolean}
 */
const filterFn = (n) => isValidFileOrDir(n) && notIgnoredFn(n);

/**
 * @param {string[]} ns
 * @return {string[]}
 */
const preProcessFn = (ns) => ns.map((n) => resolve(n)).filter((n) => filterFn(n));

/**
 * @param {string[]} nodes
 * @yields {string}
 * @return {AsyncGenerator<string>}
 */
const collectFiles = async function* (nodes) {
  for (const n of preProcessFn(nodes)) {
    const stats = await lstat(n);
    if (stats.isFile()) {
      yield n;
    } else if (stats.isDirectory()) {
      const children = await readdir(n);
      yield* collectFiles(children.map((c) => join(n, c)));
    }
  }
};

module.exports = {
  iterDocs,
  collectFiles,
};
