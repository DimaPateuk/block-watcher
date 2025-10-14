import { Module } from '@nestjs/common';
import { RPC_SERVICE } from '../rpc/rpc.types';
import { ViemRpcService } from '../rpc/viem-rpc.service';

@Module({
  providers: [{ provide: RPC_SERVICE, useClass: ViemRpcService }],
  exports: [RPC_SERVICE],
})
export class ViemModule {}
