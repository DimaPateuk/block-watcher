// src/blocks/dto/block.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import { EvmBlock } from "@prisma/client";

export class EvmBlockDto {
  @ApiProperty({
    type: String,
    format: "int64",
    example: "21341234",
    description: "Block number (stringified bigint)",
  })
  number!: string;

  @ApiProperty({ type: String, example: "0xabc..." })
  hash!: string;

  @ApiProperty({ type: String, example: "0xdef..." })
  parentHash!: string;

  @ApiProperty({ type: String, example: "1728339200" })
  timestamp!: string;
}

export function toEvmBlockDto(block: EvmBlock): EvmBlockDto {
  return {
    number: block.number.toString(),
    hash: block.hash,
    parentHash: block.parentHash,
    timestamp: block.timestamp.toString(),
  };
}
