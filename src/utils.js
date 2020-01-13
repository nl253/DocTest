const { lstat, readdir } = require('fs').promises;
const { join, resolve, basename } = require('path');
const { parseExpressionAt, parse } = require('acorn');

const ignorePatterns = [
  'node_modules',
  'test',
  'bower_modules',
  '.git',
];

/**
 * @param {string} text
 * @return {Generator<{given: string, expect: string}>}
 */
const iterDocs = function* (text) {
  const comments = [];
  const opts = {
    ecmaVersion: 10,
    allowReturnOutsideFunction: false,
    allowReserved: true,
    allowImportExportEverywhere: false,
  };
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
 * @param {string[]} nodes
 * @yields {string}
 * @return {AsyncGenerator<string>}
 */
const collectFiles = async function* (nodes) {
  /**
   * @param {string} p
   * @return {boolean}
   */
  const filterFn = (p) => (
    p.endsWith('.js')
    || p.endsWith('.ts')
    || basename(p).indexOf('.') < 0)
    // @ts-ignore
    && ignorePatterns.reduce((ok, pat) => ok && (p.indexOf(pat) < 0), true);
  for (const n of nodes.map((p) => resolve(p)).filter((p) => filterFn(p))) {
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
