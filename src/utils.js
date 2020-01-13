const { lstat, readdir } = require('fs').promises;
const { join, resolve, basename } = require('path');
const { parseExpressionAt, parse } = require('acorn');

const ignorePatterns = [
  'node_modules',
  'test',
  'bower_modules',
  '.git',
];

const opts = {
  ecmaVersion: 10,
  allowReturnOutsideFunction: false,
  allowReserved: true,
  allowImportExportEverywhere: false,
};

/**
 * @param {string} text
 * @return {Generator<{given: string, expect: string}>}
 */
const iterDocs = function* (text) {
  const comments = [];
  parse(text, {
    ...opts,
    sourceType: 'module',
    onComment: ((isBlock, comment) => {
      if (isBlock && comment.search(/^\*\n\s+\*\s+/) >= 0) {
        for (const c of comment
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line !== '' && line.search(/^\*\s+@test\s+\{/) >= 0)
          .map((s) => s.replace(/^\*\s+@test\s+\{/, ''))) {
          comments.push(c);
        }
      }
    }),
    allowHashBang: true,
  });
  for (let c of comments) {
    const astGiven = parseExpressionAt(c, 0, { ...opts, sourceType: 'script' });
    const given = c.slice(astGiven.start, astGiven.end);
    c = c.slice(astGiven.end + 2);
    const expectAst = parseExpressionAt(c, 0, { ...opts, sourceType: 'script' });
    const expect = c.slice(expectAst.start, expectAst.end);
    yield { given, expect };
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
