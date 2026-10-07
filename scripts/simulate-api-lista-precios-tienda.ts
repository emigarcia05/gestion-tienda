/**
 * Simula la llegada de datos de la API para prod_propios (upsert).
 * Usar para probar que la tabla se llena correctamente.
 * Ejecutar: npm run db:simulate-api-tienda
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

function loadEnv() {
  const root = process.cwd();
  for (const name of [".env", ".env.local"]) {
    const envPath = join(root, name);
    if (existsSync(envPath)) {
      const env = readFileSync(envPath, "utf-8");
      for (const line of env.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const m = trimmed.match(/^([^=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
      return;
    }
  }
}
loadEnv();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("✗ DATABASE_URL no está definida.");
  process.exit(1);
}
if (dbUrl.includes("tu-endpoint") || dbUrl.includes("usuario:password")) {
  console.error("✗ Reemplazá DATABASE_URL en .env por la connection string real de Neon.");
  process.exit(1);
}

export interface FilaListaPreciosTienda {
  cod_externo: string;
  cod_tienda: string;
  rubro?: string;
  sub_rubro?: string;
  marca?: string;
  proveedor?: string;
  descripcion_tienda?: string;
  costo_compra: number;
  px_lista_tienda: number;
  stock_maipu?: number;
  stock_guaymallen?: number;
  /** Default true en script de demo (simula ítem stockeable). */
  stockeable?: boolean;
}

const UPSERT_SQL = `
INSERT INTO prod_propios (
  cod_ext, cod_tienda, rubro, sub_rubro, marca, proveedor, descripcion_tienda,
  costo_compra, px_lista_tienda, stock_maipu, stock_guaymallen, stockeable
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (cod_ext) DO UPDATE SET
  cod_tienda       = EXCLUDED.cod_tienda,
  rubro            = EXCLUDED.rubro,
  sub_rubro        = EXCLUDED.sub_rubro,
  marca            = EXCLUDED.marca,
  proveedor        = EXCLUDED.proveedor,
  descripcion_tienda = EXCLUDED.descripcion_tienda,
  costo_compra     = EXCLUDED.costo_compra,
  px_lista_tienda  = EXCLUDED.px_lista_tienda,
  stock_maipu      = EXCLUDED.stock_maipu,
  stock_guaymallen = EXCLUDED.stock_guaymallen,
  stockeable       = EXCLUDED.stockeable;
`;

async function main() {
  const { getClient } = await import("../src/lib/db");

  const datosSimulados: FilaListaPreciosTienda[] = [
    {
      cod_externo: "DEM-001",
      cod_tienda: "TIENDA-01",
      rubro: "Pinturas",
      sub_rubro: "Látex",
      marca: "Marca A",
      proveedor: "Proveedor Demo",
      descripcion_tienda: "Producto ejemplo 1",
      costo_compra: 80,
      px_lista_tienda: 120,
      stock_maipu: 10,
      stock_guaymallen: 5,
    },
    {
      cod_externo: "DEM-002",
      cod_tienda: "TIENDA-01",
      rubro: "Pinturas",
      sub_rubro: "Esmalte",
      marca: "Marca B",
      proveedor: "Proveedor Demo",
      descripcion_tienda: "Producto ejemplo 2",
      costo_compra: 150,
      px_lista_tienda: 240,
      stock_maipu: 3,
      stock_guaymallen: 8,
    },
    {
      cod_externo: "DEM-003",
      cod_tienda: "TIENDA-01",
      rubro: "Herramientas",
      sub_rubro: "Brochas",
      marca: "Marca C",
      proveedor: "Proveedor Ejemplo",
      descripcion_tienda: "Producto ejemplo 3",
      costo_compra: 200,
      px_lista_tienda: 320,
      stock_maipu: 0,
      stock_guaymallen: 12,
    },
  ];

  const client = await getClient();
  try {
    for (const row of datosSimulados) {
      await client.query(UPSERT_SQL, [
        row.cod_externo,
        row.cod_tienda,
        row.rubro ?? null,
        row.sub_rubro ?? null,
        row.marca ?? null,
        row.proveedor ?? null,
        row.descripcion_tienda ?? null,
        row.costo_compra,
        row.px_lista_tienda,
        row.stock_maipu ?? 0,
        row.stock_guaymallen ?? 0,
        row.stockeable !== false,
      ]);
    }
    console.log(`✓ Upsert simulando API: ${datosSimulados.length} filas en prod_propios.`);
  } finally {
    client.release();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error:", err);
  process.exit(1);
});
