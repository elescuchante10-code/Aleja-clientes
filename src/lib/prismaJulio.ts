import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Conexión de solo lectura (desde el panel) a la base del chatbot Julio /
// Soluciones de IA. Es un proyecto de Vercel/Neon separado; el chatbot de
// Julio nunca se toca desde aquí, solo se leen sus conversaciones para
// mostrarlas en el panel combinado.
const globalForPrismaJulio = globalThis as unknown as { prismaJulio?: PrismaClient };

function createPrismaJulioClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.JULIO_DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prismaJulio = globalForPrismaJulio.prismaJulio ?? createPrismaJulioClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrismaJulio.prismaJulio = prismaJulio;
}
