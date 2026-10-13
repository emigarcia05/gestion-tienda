/**
 * Cliente Prisma para Neon/PostgreSQL.
 * Usa @prisma/adapter-pg con DATABASE_URL (conexión pooled recomendada para Neon).
 * Normaliza SSL para evitar el warning de pg-connection-string (usa sslmode=verify-full).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function normalizeConnectionString(url: string): string {
  try {
    const u = new URL(url);
    const ssl = u.searchParams.get("sslmode");
    // Evitar warning de pg-connection-string: usar verify-full (comportamiento actual de prefer/require)
    if (!ssl || ["prefer", "require", "verify-ca"].includes(ssl)) {
      u.searchParams.set("sslmode", "verify-full");
    }
    return u.toString();
  } catch {
    return url;
  }
}

function createPrisma() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL no está definida. Configurala en .env o en las variables de entorno.");
  }
  const connectionString = normalizeConnectionString(raw);
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    omit: { globalPersonal: { contrasena: true } },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrisma> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
