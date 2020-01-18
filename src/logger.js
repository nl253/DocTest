const { red, yellow } = require('chalk');
const util = require('util');

let LOGGER;

class Logger {
  constructor(lvl = 0) {
    this.lvl = lvl;
    this.START_TM = {};
  }

  /**
   * @notest
   * @param {number} lvl
   * @param {string[]} msg
   * @param {function(string): string} fmt
   */
  write(lvl, msg, fmt = (x) => x) {
    if (lvl >= this.lvl) {
      process.stdout.write(fmt(msg.map((m) => (typeof m === 'string' ? m : util.inspect(m))).join(' ')));
      process.stdout.write('\n');
    }
  }

  /**
   * @notest
   * @param {...string} msg
   */
  debug(...msg) {
    return this.write(0, msg);
  }

  /**
   * @notest
   * @param {...string} msg
   */
  info(...msg) {
    return this.write(1, msg);
  }

  /**
   * @notest
   * @param {...string} msg
   */
  log(...msg) {
    return this.write(2, msg);
  }

  /**
   * @notest
   * @param {...string} msg
   */
  warn(...msg) {
    return this.write(3, msg, yellow);
  }

  /**
   * @notest
   * @param {...string} msg
   */
  error(...msg) {
    return this.write(4, msg, red);
  }

  /**
   * @notest
   * @param {string} label
   */
  startTime(label = 'main') {
    // @ts-ignore
    this.START_TM[label] = new Date().getTime();
  }

  /**
   * @notest
   * @param {string} label
   */
  endTime(label = 'main') {
    // @ts-ignore
    const diff = new Date().getTime() - this.START_TM[label];
    return this.log(`${label} took ${diff}ms`);
  }
}

/**
 * @param {number} [lvl]
 * @return {Logger}
 */
module.exports = (lvl) => {
  if (LOGGER === undefined) {
    LOGGER = new Logger(lvl);
  }
  return LOGGER;
};
