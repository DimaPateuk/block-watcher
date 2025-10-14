import { Module } from '@nestjs/common';
import { ViemRpcService } from './viem-rpc.service';
import { RPC_SERVICE } from './rpc.types';

@Module({
  providers: [
    ViemRpcService,
    {
      provide: RPC_SERVICE,
      useClass: ViemRpcService,
    },
  ],
  exports: [RPC_SERVICE],
})
export class RpcModule {}
