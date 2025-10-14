import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { Injectable, Logger } from "@nestjs/common";

type EvmBlockInsert = Omit<Prisma.EvmBlockUncheckedCreateInput, "id">;

@Injectable()
export class EvmBlocksService {
  private readonly logger = new Logger(EvmBlocksService.name);
  constructor(
    private readonly prisma: PrismaService
  ) {
  }

  getLatest(chainId: number) {
    return this.prisma.evmBlock.findFirst({
      where: { chainId },
      orderBy: { number: "desc" },
    });
  }
  byNumber(chainId: number, num: number) {
    return this.prisma.evmBlock.findFirst({
      where: { chainId, number: num },
      orderBy: { number: "desc" },
    });
  }

  upsertBlocks(input: EvmBlockInsert[]) {
    return this.prisma.evmBlock.createMany({
      data: input,
      skipDuplicates: true,
    });
  }


  async findMissingFullRange(chainId: number) {
    const first = await this.prisma.evmBlock.findFirst({
      where: { chainId },
      orderBy: { number: "asc" },
      select: { number: true },
    });

    const last = await this.prisma.evmBlock.findFirst({
      where: { chainId },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    if (!first || !last) {
      return [];
    }

    const from = first.number;
    const to = last.number;

    if (to < from) return [];

    const limit = 10;
    const ranges = await this.prisma.$queryRaw<
      Array<{ start_missing: bigint; end_missing: bigint }>
    >`
    WITH ordered AS (
      SELECT
        b."number",
        LEAD(b."number") OVER (ORDER BY b."number") AS next_number
      FROM "EvmBlock" b
      WHERE b."chainId" = ${chainId}
        AND b."number" BETWEEN ${from}::bigint AND ${to}::bigint
    )
    SELECT
      (o."number" + 1)::bigint AS start_missing,
      (o.next_number - 1)::bigint AS end_missing
    FROM ordered o
    WHERE o.next_number IS NOT NULL
      AND o.next_number > o."number" + 1
      LIMIT ${limit};
    `;
    const missing: bigint[] = [];
    for (const r of ranges) {
      for (
        let n = r.start_missing;
        n <= r.end_missing && missing.length < limit;
        n++
      ) {
        missing.push(n);
      }
      if (missing.length >= limit) break;
    }

    return missing;
  }
}
