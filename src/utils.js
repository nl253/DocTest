/**
 * @param {Array<*>} xs
 * @param {function(*): number} f
 * @test {argMin([1, 2, 3], x => x)} 1
 * @test {argMin([3, -4, 3], x => x ** 2)} 3
 * @return {*}
 */
const argMin = (xs, f) => {
  let smallest = xs[0];
  let smallestScore = f(smallest);
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i];
    const score = f(x);
    if (score < smallestScore) {
      smallest = x;
      smallestScore = score;
    }
  }
  return smallest;
};


module.exports = {
  argMin,
};
