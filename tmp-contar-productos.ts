import "dotenv/config";
import { prisma } from "./src/lib/prisma";

async function main() {
  const grupos = await prisma.prodPropio.groupBy({
    by: ["idProducto"],
    where: { idProducto: { not: null } },
    _count: { codTienda: true },
    orderBy: { _count: { codTienda: "desc" } },
    take: 1,
  });
  const id = grupos[0]?.idProducto;
  const producto = id
    ? await prisma.prodProducto.findUnique({
        where: { id },
        select: {
          nombre: true,
          marca: { select: { nombre: true } },
          skus: {
            take: 3,
            select: {
              descripcionTienda: true,
              presentacion: { select: { texto: true } },
              color: { select: { nombre: true } },
            },
          },
        },
      })
    : null;
  console.log(JSON.stringify({ variantes: grupos[0]?._count.codTienda ?? 0, producto }));
}

void main().finally(async () => {
  await prisma.$disconnect();
});
