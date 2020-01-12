const { lstat, readdir } = require('fs').promises;
const { join, resolve, basename } = require('path');
const { parseExpressionAt } = require('acorn');

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
  for (const m of text.matchAll(/\/\*\*(.*?)\*\//gsm)) {
    if (m[0].indexOf(' * @test {') >= 0) {
      /** @type {string} */
      // @ts-ignore
      let innerMatch = m[0].match(/ \* @test \{([^\n]*)/)[0].replace('* @test {', '');
      const astGiven = parseExpressionAt(innerMatch, 0, {
        ecmaVersion: 9,
        sourceType: 'script',
      });
      const given = innerMatch.slice(astGiven.start, astGiven.end);
      innerMatch = innerMatch.slice(astGiven.end + 2);
      const expectAst = parseExpressionAt(innerMatch, 0, {
        ecmaVersion: 9,
        sourceType: 'script',
      });
      const expect = innerMatch.slice(expectAst.start, expectAst.end);
      yield {
        given,
        expect,
      };
    }
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
