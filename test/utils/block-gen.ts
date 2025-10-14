import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

type EvmBlockInsert = Omit<Prisma.EvmBlockUncheckedCreateInput, "id">;

const ZERO_HASH = "0x" + "00".repeat(32);

function makeHash(input: string): string {
  return "0x" + createHash("sha256").update(input).digest("hex");
}

type RangeByCount = {
  /** e.g. startNumber: 10n, count: 5 => 10..14 */
  startNumber: bigint;
  count: number;
};

type RangeByBounds = {
  /** inclusive bounds, e.g. from: 10n, to: 100n */
  from: bigint;
  to: bigint;
};

type SimpleOpts = {
  chainId?: number;
  startTimestamp?: bigint;   // default 1_700_000_000n
  secondsPerBlock?: bigint;  // default 1n
  salt?: string;             // default "block-gen-v1"
  zeroGenesis?: boolean;     // default false
};

type BlockRange = (RangeByCount | RangeByBounds) & SimpleOpts;

/**
 * Create blocks for multiple ranges. Each range is independent.
 * `cb` receives cumulative blocks after each range.
 */
export function createBlockRanges(
  ranges: BlockRange[],
  cb?: (allSoFar: EvmBlockInsert[]) => void
): EvmBlockInsert[] {
  const all: EvmBlockInsert[] = [];

  for (const r of ranges) {
    const chainId = r.chainId ?? 1;
    const secondsPerBlock = r.secondsPerBlock ?? 1n;
    const startTimestamp = r.startTimestamp ?? 1_700_000_000n;
    const salt = r.salt ?? "block-gen-v1";
    const zeroGenesis = r.zeroGenesis ?? false;

    const isBounds = (x: BlockRange): x is RangeByBounds =>
      (x as RangeByBounds).from !== undefined && (x as RangeByBounds).to !== undefined;

    const startNumber = isBounds(r) ? r.from : r.startNumber;
    const count = isBounds(r) ? Number(r.to - r.from + 1n) : r.count;
    if (count <= 0) continue;

    let parentHash = zeroGenesis
      ? ZERO_HASH
      : makeHash(`GENESIS|chain:${chainId}|num:${startNumber - 1n}|salt:${salt}`);

    for (let i = 0; i < count; i++) {
      const number = startNumber + BigInt(i);
      const timestamp = startTimestamp + secondsPerBlock * BigInt(i);
      const hash = makeHash(
        `CHAIN:${chainId}|NUM:${number}|PARENT:${parentHash}|SALT:${salt}` 
      );

      all.push({ chainId, number, hash, parentHash, timestamp });
      parentHash = hash;
    }

    cb?.(all);
  }

  return all;
}

/** Convenience: single contiguous range (inclusive) */
export function createBlockRange(
  from: bigint,
  to: bigint,
  opts?: SimpleOpts
): EvmBlockInsert[] {
  if (to < from) return [];
  return createBlockRanges([{ from, to, ...(opts ?? {}) }]);
}

/** Convenience: count from a startNumber */
export function createBlocks(
  count: number,
  opts?: SimpleOpts & { startNumber?: bigint }
): EvmBlockInsert[] {
  const startNumber = opts?.startNumber ?? 100n;
  return createBlockRanges([{ startNumber, count, ...(opts ?? {}) }]);
}

/** Latest by number */
export function getExpectedLatest(
  blocks: EvmBlockInsert[]
): EvmBlockInsert | null {
  if (!blocks.length) return null;
  return blocks.reduce((a, b) => (b.number > a.number ? b : a));
}

/** Create blocks with gaps (holes) for testing missing block scenarios */
export function createBlocksWithHoles(
  ranges: { from: bigint; to: bigint }[],
  opts?: SimpleOpts
): EvmBlockInsert[] {
  return createBlockRanges(
    ranges.map(range => ({ ...range, ...(opts ?? {}) }))
  );
}

/** Get missing block numbers in a sequence */
export function getMissingNumbers(
  blocks: EvmBlockInsert[],
  expectedRange: { from: bigint; to: bigint }
): bigint[] {
  if (!blocks.length) return [];
  
  const existing = new Set(blocks.map(b => b.number));
  const missing: bigint[] = [];
  
  for (let n = expectedRange.from; n <= expectedRange.to; n++) {
    if (!existing.has(n)) {
      missing.push(n);
    }
  }
  
  return missing;
}
