const now = function now() {
  const hr = process.hrtime();
  return hr[0] + (hr[1] / 1e9);
};

/**
 * Execute the benchmark
 *
 * @param {function} f The function to execute (needs to be a promise)
 * @param {number} n The number of iterations
 * @returns {number} Average execution time
 */
async function execute(f, n) {
  const start = now();
  let countdown = n;
  while (countdown > 0) {
    await f();
    countdown -= 1;
  }
  return (now() - start) / n;
}

module.exports.execute = execute;
