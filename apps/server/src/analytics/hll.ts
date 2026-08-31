const BUCKETS = 64;
const ALPHA = 0.709;

export function createIdentitySketch(values: Iterable<string>): number[] {
  const registers = Array.from({ length: BUCKETS }, () => 0);
  for (const value of values) {
    if (!/^[a-f\d]{16,}$/i.test(value)) continue;
    const bucket = Number.parseInt(value.slice(0, 2), 16) & (BUCKETS - 1);
    const tail = BigInt(`0x${value.slice(2, 18)}`);
    const width = 64;
    const leading = tail === 0n ? width : width - tail.toString(2).length;
    registers[bucket] = Math.max(registers[bucket] ?? 0, leading + 1);
  }
  return registers;
}

export function mergeIdentitySketches(sketches: readonly (readonly number[])[]): number[] {
  return Array.from({ length: BUCKETS }, (_, index) =>
    Math.max(0, ...sketches.map((sketch) => sketch[index] ?? 0)),
  );
}

export function estimateIdentitySketch(registers: readonly number[]): number {
  if (
    registers.length !== BUCKETS ||
    registers.some((register) => !Number.isSafeInteger(register) || register < 0 || register > 65)
  )
    return 0;
  const harmonic = registers.reduce((sum, register) => sum + 2 ** -register, 0);
  const raw = (ALPHA * BUCKETS * BUCKETS) / harmonic;
  const zeroes = registers.filter((register) => register === 0).length;
  const corrected = zeroes > 0 && raw <= 2.5 * BUCKETS ? BUCKETS * Math.log(BUCKETS / zeroes) : raw;
  return Math.max(0, Math.round(corrected));
}
