export function secureRandomInt(minInclusive, maxExclusive) {
  if (!Number.isSafeInteger(minInclusive) || !Number.isSafeInteger(maxExclusive)) {
    throw new TypeError('Random bounds must be safe integers');
  }
  const range = maxExclusive - minInclusive;
  if (range <= 0 || range > 0x1_0000_0000) {
    throw new RangeError('Random range must be between 1 and 2^32');
  }

  const values = new Uint32Array(1);
  const rejectionLimit = 0x1_0000_0000 - (0x1_0000_0000 % range);
  do {
    globalThis.crypto.getRandomValues(values);
  } while (values[0] >= rejectionLimit);

  return minInclusive + (values[0] % range);
}
