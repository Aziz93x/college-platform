// mulberry32: a small 32-bit generator. The same seed always gives the same sequence,
// so `pnpm seed:demo --seed 42` builds the same college every time. Returns values in [0, 1).
export function createRandom(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
