import "dotenv/config";
import { prisma } from "./src/lib/prisma";

async function main() {
  const filas = await prisma.prodPropio.findMany({
    where: { descripcionTienda: { contains: "MONOTOP", mode: "insensitive" } },
    select: {
      codTienda: true,
      descripcionTienda: true,
      habilitado: true,
      idMarca: true,
      terminacion: true,
      marcaRelation: { select: { nombre: true } },
      presentacion: { select: { texto: true } },
      color: { select: { nombre: true } },
    },
    take: 40,
  });
  for (const f of filas) {
    console.log(
      [
        f.habilitado ? "ON" : "OFF",
        f.codTienda,
        f.marcaRelation?.nombre ?? "-",
        f.presentacion?.texto ?? "(sin pres)",
        f.color?.nombre ?? "(sin color)",
        f.terminacion ?? "(sin term)",
        f.descripcionTienda,
      ].join(" | ")
    );
  }
  const [total, conPres, conColor, conTerm, conMarca] = await Promise.all([
    prisma.prodPropio.count({ where: { habilitado: true } }),
    prisma.prodPropio.count({ where: { habilitado: true, idPresentacion: { not: null } } }),
    prisma.prodPropio.count({ where: { habilitado: true, idColor: { not: null } } }),
    prisma.prodPropio.count({ where: { habilitado: true, terminacion: { not: null } } }),
    prisma.prodPropio.count({ where: { habilitado: true, idMarca: { not: null } } }),
  ]);
  console.log({ total, conPres, conColor, conTerm, conMarca });
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "error");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
