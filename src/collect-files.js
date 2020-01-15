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

module.exports = collectFiles;
