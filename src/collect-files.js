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
const collectFiles = async function* (nodes, { fileIgnoreRegex, fileRegex, log }) {
  for (const n of preProcessFn(nodes)) {
    const stats = await lstat(n);
    if (stats.isFile()) {
      if ((n.search(fileRegex) >= 0) && (n.search(fileIgnoreRegex) < 0)) {
        log.debug(`found file ${n}`);
        yield n;
      } else {
        log.debug(`file ${n} filtered out`);
      }
    } else if (stats.isDirectory()) {
      if (n.search(fileIgnoreRegex) < 0) {
        log.debug(`found dir ${n}`);
        const children = await readdir(n);
        log.debug(`${children.length} children`);
        yield* collectFiles(children.map((c) => join(n, c)), {
          fileIgnoreRegex,
          fileRegex,
          log,
        });
      } else {
        log.debug(`dir ${n} filtered out`);
      }
    }
  }
};
module.exports = collectFiles;
