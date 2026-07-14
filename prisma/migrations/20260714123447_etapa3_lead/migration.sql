-- CreateTable
CREATE TABLE "conversaciones" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "momento" TEXT NOT NULL DEFAULT 'APERTURA',
    "sector" TEXT,
    "tamano" TEXT,
    "senalG" TEXT,
    "senalL" TEXT,
    "senalF" TEXT,
    "senalB" TEXT,
    "aceptoPolitica" BOOLEAN NOT NULL DEFAULT false,
    "aceptadoAt" TIMESTAMP(3),
    "turnos" JSONB NOT NULL,
    "turnosTotal" INTEGER NOT NULL DEFAULT 0,
    "necesidadNoVista" TEXT,

    CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "nombre" TEXT,
    "contacto" TEXT NOT NULL,
    "tipoContacto" TEXT NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversaciones_sessionId_key" ON "conversaciones"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_conversacionId_key" ON "leads"("conversacionId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "conversaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
