import "dotenv/config";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { nombreDeProducto } from "./src/lib/prodProducto";
import { prisma } from "./src/lib/prisma";

async function main() {
  const filas = await prisma.prodPropio.findMany({
    where: { productoManual: false, idMarca: { not: null } },
    select: {
      codTienda: true,
      descripcionTienda: true,
      idMarca: true,
      terminacion: true,
      presentacion: { select: { texto: true } },
      color: { select: { nombre: true } },
    },
  });

  const filasNombre: { cod: string; idMarca: string; nombre: string }[] = [];
  for (const fila of filas) {
    const descripcion = (fila.descripcionTienda ?? "").trim();
    if (!fila.idMarca || descripcion.length === 0) continue;
    filasNombre.push({
      cod: fila.codTienda,
      idMarca: fila.idMarca,
      nombre: nombreDeProducto({
        descripcion,
        presentacion: fila.presentacion?.texto ?? null,
        color: fila.color?.nombre ?? null,
        terminacion: fila.terminacion,
      }),
    });
  }

  const vistos = new Set<string>();
  const productos: { id: string; idMarca: string; nombre: string }[] = [];
  for (const fila of filasNombre) {
    const clave = `${fila.idMarca}\u0000${fila.nombre}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    productos.push({ id: randomUUID(), idMarca: fila.idMarca, nombre: fila.nombre });
  }

  const lote = 400;
  for (let i = 0; i < productos.length; i += lote) {
    const parte = productos.slice(i, i + lote);
    const values = Prisma.join(
      parte.map((fila) => Prisma.sql`(${fila.id}::text, ${fila.idMarca}::text, ${fila.nombre}::text, NOW())`)
    );
    await prisma.$executeRaw`
      INSERT INTO prod_productos (id, id_marca, nombre, updated_at)
      VALUES ${values}
      ON CONFLICT (id_marca, nombre) DO NOTHING
    `;
  }

  for (let i = 0; i < filasNombre.length; i += lote) {
    const parte = filasNombre.slice(i, i + lote);
    const values = Prisma.join(
      parte.map((fila) => Prisma.sql`(${fila.cod}::text, ${fila.idMarca}::text, ${fila.nombre}::text)`)
    );
    await prisma.$executeRaw`
      UPDATE prod_lista AS pl
      SET id_producto = p.id
      FROM (VALUES ${values}) AS v(cod, id_marca, nombre)
      JOIN prod_productos AS p ON p.id_marca = v.id_marca AND p.nombre = v.nombre
      WHERE pl.cod_tienda = v.cod
        AND pl.producto_manual = false
    `;
  }

  await prisma.$executeRaw`
    DELETE FROM prod_productos AS p
    WHERE NOT EXISTS (SELECT 1 FROM prod_lista AS pl WHERE pl.id_producto = p.id)
  `;

  const monotop = await prisma.prodPropio.findMany({
    where: { codTienda: { in: ["2766", "2767"] } },
    select: { codTienda: true, idProducto: true, producto: { select: { nombre: true } } },
  });
  const [productosN, skus] = await Promise.all([
    prisma.prodProducto.count(),
    prisma.prodPropio.count({ where: { idProducto: { not: null } } }),
  ]);
  console.log(JSON.stringify({ productosN, skus, monotop }));
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "error");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
