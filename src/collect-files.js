const { lstat, readdir } = require('fs').promises;
const { join, resolve, basename } = require('path');

/** @type {string[]} */
const ignorePatterns = require('./ignore-patterns.json');

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
 * @test {filterFn('./node_modules/some-file.js')} false
 * @test {filterFn('script.ts')} true
 * @test {filterFn('otherScript.js')} true
 * @return {boolean}
 */
const notIgnoredFn = (n) => ignorePatterns.reduce((ok, pat) => ok && (n.indexOf(pat) < 0), true);

/**
 * @notest
 * @param {string} n
 * @return {boolean}
 */
const filterFn = (n) => isValidFileOrDir(n) && notIgnoredFn(n);

/**
 * @notest
 * @param {string[]} ns
 * @return {string[]}
 */
const preProcessFn = (ns) => ns.map((n) => resolve(n)).filter((n) => filterFn(n));

/**
 * @notest
 * @param {string[]} nodes
 * @param {{fileRegex: RegExp, fileIgnoreRegex: RegExp}} opts
 * @yields {string}
 * @return {AsyncGenerator<string>}
 */
const collectFiles = async function* (nodes, opts) {
  for (const n of preProcessFn(nodes)) {
    if (n.search(opts.fileIgnoreRegex) < 0) {
      const stats = await lstat(n);
      if (stats.isFile() && n.search(opts.fileRegex) >= 0 && n.search(opts.fileIgnoreRegex) < 0) {
        yield n;
      } else if (stats.isDirectory()) {
        const children = await readdir(n);
        yield* collectFiles(children.map((c) => join(n, c)), opts);
      }
    }
  }
};

module.exports = collectFiles;
