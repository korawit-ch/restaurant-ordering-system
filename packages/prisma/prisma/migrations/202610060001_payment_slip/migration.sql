CREATE TABLE "PaymentSlip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "qrPayloadHash" TEXT,
    "qrReadable" BOOLEAN NOT NULL,
    "duplicateWarning" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentSlip_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentSlip_orderId_key" ON "PaymentSlip"("orderId");
CREATE UNIQUE INDEX "PaymentSlip_objectKey_key" ON "PaymentSlip"("objectKey");
CREATE UNIQUE INDEX "PaymentSlip_tenantId_branchId_orderId_key" ON "PaymentSlip"("tenantId","branchId","orderId");
CREATE INDEX "PaymentSlip_tenantId_branchId_sha256_idx" ON "PaymentSlip"("tenantId","branchId","sha256");
CREATE INDEX "PaymentSlip_tenantId_branchId_qrPayloadHash_idx" ON "PaymentSlip"("tenantId","branchId","qrPayloadHash");
ALTER TABLE "PaymentSlip" ADD CONSTRAINT "PaymentSlip_tenantId_branchId_fkey" FOREIGN KEY ("tenantId","branchId") REFERENCES "Branch"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSlip" ADD CONSTRAINT "PaymentSlip_tenantId_branchId_orderId_fkey" FOREIGN KEY ("tenantId","branchId","orderId") REFERENCES "Order"("tenantId","branchId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
