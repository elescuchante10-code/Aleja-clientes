-- AlterTable
ALTER TABLE "conversaciones" ADD COLUMN     "creditoDigresion" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "deudaDeValor" TEXT NOT NULL DEFAULT 'SALDADA',
ADD COLUMN     "espejoEntregado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profundidadVinculo" INTEGER NOT NULL DEFAULT 0;
