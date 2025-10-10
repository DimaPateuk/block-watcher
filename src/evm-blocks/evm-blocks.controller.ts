import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { EvmBlocksService } from "./evm-blocks.service";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { EvmBlockDto, toEvmBlockDto } from "./dto/evm-block.dto";

@ApiTags("evm/blocks")
@Controller("evm/blocks")
export class EvmBlocksController {
  constructor(private readonly evmBlocks: EvmBlocksService) {}
  @Get("health") getHealth() {
    return { ok: true };
  }

  @Get(":chainId/latest")
  @ApiOkResponse({ type: [EvmBlockDto] })
  async latest(@Param("chainId", ParseIntPipe) chainId: number) {
    const res = await this.evmBlocks.getLatest(chainId);

    if (!res) return { error: "Not found" };

    return toEvmBlockDto(res);
  }
  @Get(":chainId/:number")
  async byNumber(
    @Param("chainId", ParseIntPipe) chainId: number,
    @Param("number", ParseIntPipe) number: number
  ) {
    const res = await this.evmBlocks.byNumber(chainId, number);
    if (!res) return { error: "Not found" };
    return toEvmBlockDto(res);
  }
}
