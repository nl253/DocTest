/* eslint-disable no-unused-vars */
/**
 * @param {number} x
 * @param {number} y
 * @test {add(2, 3)} 5
 */
const add = (x, y) => x + y;

/**
 * @param {Array<*>} xs
 * @param {Array<*>} ys
 * @param {function(*, *): *} f
 * @returns {Array<*>} ys
 * @test {zipWith([1, 2, 3], [3, 1, 0], (x, y) => x + y)} [4, 3, 3]
 */
const zipWith = (xs, ys, f) => {
  const end = Math.min(xs.length, ys.length);
  const zs = Array(end).fill(null);
  for (let i = 0; i < end; i++) {
    zs[i] = f(xs[i], ys[i]);
  }
  return zs;
};

/**
 * @param {...*} xs
 * @return {Array<*>}
 * @test {truthy(0, 1, 2, 3)} [1, 2, 3]
 * @test {truthy(0, 1, 2, 3)} [1, 2, 3]
 */
const truthy = (...xs) => xs.filter(Boolean);

module.exports = {
  truthy,
  add,
  zipWith,
};
