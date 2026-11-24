import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function normalize(url) {
  const u = new URL(url);
  const ssl = u.searchParams.get("sslmode");
  if (!ssl || ["prefer", "require", "verify-ca"].includes(ssl)) {
    u.searchParams.set("sslmode", "verify-full");
  }
  return u.toString();
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: normalize(process.env.DATABASE_URL) }),
});

const grupos = await prisma.whatsappPruebaMensaje.groupBy({
  by: ["direccion", "estado"],
  _count: { _all: true },
});
const recientes = await prisma.whatsappPruebaMensaje.findMany({
  orderBy: { createdAt: "desc" },
  take: 15,
  select: {
    direccion: true,
    estado: true,
    tipo: true,
    createdAt: true,
    telefono: true,
    nombre: true,
    cuerpo: true,
  },
});

console.log(
  JSON.stringify(
    {
      grupos,
      recientes: recientes.map((f) => ({
        direccion: f.direccion,
        estado: f.estado,
        tipo: f.tipo,
        creado: f.createdAt.toISOString(),
        tel4: f.telefono.slice(-4),
        nombre: f.nombre ? "si" : "no",
        cuerpo: f.cuerpo.slice(0, 60),
      })),
    },
    null,
    2
  )
);

await prisma.$disconnect();
