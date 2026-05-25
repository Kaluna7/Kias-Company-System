/**
 * Slowly increases progress while waiting on an indeterminate API call.
 * @param {(n: number) => void} setProgress
 * @param {boolean} active
 * @param {{ max?: number, start?: number, step?: number, intervalMs?: number }} [opts]
 * @returns {() => void} cleanup
 */
export function runSimulatedProgress(setProgress, active, opts = {}) {
  const { max = 90, start = 10, step = 4, intervalMs = 280 } = opts;
  if (!active) {
    setProgress(100);
    return () => {};
  }
  let current = start;
  setProgress(current);
  const id = setInterval(() => {
    if (current < max) {
      current = Math.min(max, current + step);
      setProgress(current);
    }
  }, intervalMs);
  return () => clearInterval(id);
}
