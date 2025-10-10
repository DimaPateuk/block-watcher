-- CreateTable
CREATE TABLE "EvmBlock" (
    "id" BIGSERIAL NOT NULL,
    "chainId" INTEGER NOT NULL,
    "number" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "parentHash" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,

    CONSTRAINT "EvmBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_evm_chain_number" ON "EvmBlock"("chainId", "number");

-- CreateIndex
CREATE INDEX "idx_evm_chain_timestamp" ON "EvmBlock"("chainId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "uq_evm_chain_number" ON "EvmBlock"("chainId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_evm_chain_hash" ON "EvmBlock"("chainId", "hash");
