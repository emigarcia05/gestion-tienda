import { prisma } from "@/lib/prisma";

export type AccionLimpiezaHuerfanoProdTienda = "delete" | "null";

export type TablaHuerfanoProdTiendaConfig = {
  /** Nombre SQL de la tabla. */
  tabla: string;
  /** Columna que referencia `prod_lista.cod_tienda`. */
  columna: string;
  accion: AccionLimpiezaHuerfanoProdTienda;
  /** Clausula SQL extra (sin `AND` inicial), p. ej. `tipo_de_pedido = 'REPOSICION'`. */
  condicionExtra?: string;
  descripcion: string;
  /** Si false, solo se procesa con `incluirHistorial: true`. */
  incluirPorDefecto: boolean;
};

/** Tablas hijas / referencias a `prod_lista.cod_tienda` que deben quedar sin huérfanos tras sync DUX. */
export const TABLAS_HUERFANOS_PROD_TIENDA: TablaHuerfanoProdTiendaConfig[] = [
  {
    tabla: "prod_listas_precios",
    columna: "cod_tienda",
    accion: "delete",
    descripcion: "Precios DUX por lista",
    incluirPorDefecto: true,
  },
  {
    tabla: "prod_listas_precios_edicion",
    columna: "cod_tienda",
    accion: "delete",
    descripcion: "Precio staging Px Listas (MARG. MAN. → precio)",
    incluirPorDefecto: true,
  },
  {
    tabla: "prod_precios_competencia",
    columna: "cod_tienda",
    accion: "delete",
    descripcion: "Precios / URLs competencia por producto",
    incluirPorDefecto: true,
  },
  {
    tabla: "proveedores_prod_lista",
    columna: "cod_tienda",
    accion: "null",
    descripcion: "Vínculos lista proveedor → tienda (limpia FK, conserva fila)",
    incluirPorDefecto: true,
  },
  {
    tabla: "prod_ped_merc",
    columna: "reposicion_cod_tienda",
    accion: "delete",
    condicionExtra: "reposicion_cod_tienda IS NOT NULL",
    descripcion: "Reglas REPOSICIÓN con cod_tienda inexistente",
    incluirPorDefecto: true,
  },
  {
    tabla: "prod_ped_historial_merc",
    columna: "cod_tienda",
    accion: "delete",
    descripcion: "Ítems de historial de pedidos (referencia blanda)",
    incluirPorDefecto: false,
  },
];

export type ResultadoLimpiezaTablaHuerfanoProdTienda = {
  tabla: string;
  columna: string;
  accion: AccionLimpiezaHuerfanoProdTienda;
  descripcion: string;
  candidatos: number;
  aplicados: number;
};

function buildWhereHuerfano(cfg: TablaHuerfanoProdTiendaConfig): string {
  const extra = cfg.condicionExtra ? ` AND (${cfg.condicionExtra})` : "";
  return `NOT EXISTS (
    SELECT 1 FROM prod_lista t WHERE t.cod_tienda = h.${cfg.columna}
  )${extra}`;
}

async function contarHuerfanos(cfg: TablaHuerfanoProdTiendaConfig): Promise<number> {
  const where = buildWhereHuerfano(cfg);
  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM ${cfg.tabla} h WHERE ${where}`
  );
  return Number(rows[0]?.count ?? 0);
}

async function aplicarLimpiezaTabla(
  cfg: TablaHuerfanoProdTiendaConfig
): Promise<number> {
  const where = buildWhereHuerfano(cfg);
  if (cfg.accion === "delete") {
    return prisma.$executeRawUnsafe(`DELETE FROM ${cfg.tabla} h WHERE ${where}`);
  }
  return prisma.$executeRawUnsafe(
    `UPDATE ${cfg.tabla} h SET ${cfg.columna} = NULL WHERE ${where}`
  );
}

export type LimpiarHuerfanosProdTiendaOpciones = {
  /** Si false, solo cuenta (dry-run). */
  execute?: boolean;
  /** Incluye tablas marcadas `incluirPorDefecto: false` (historial de pedidos). */
  incluirHistorial?: boolean;
};

/**
 * Elimina o anula referencias a `cod_tienda` que ya no existen en `prod_lista`
 * (p. ej. producto dado de baja).
 */
export async function limpiarHuerfanosProdTienda(
  opciones: LimpiarHuerfanosProdTiendaOpciones = {}
): Promise<ResultadoLimpiezaTablaHuerfanoProdTienda[]> {
  const execute = opciones.execute ?? false;
  const incluirHistorial = opciones.incluirHistorial ?? false;

  const tablas = TABLAS_HUERFANOS_PROD_TIENDA.filter(
    (t) => t.incluirPorDefecto || incluirHistorial
  );

  const candidatosPorTabla = await Promise.all(
    tablas.map(async (cfg) => ({
      cfg,
      candidatos: await contarHuerfanos(cfg),
    }))
  );

  if (!execute) {
    return candidatosPorTabla.map(({ cfg, candidatos }) => ({
      tabla: cfg.tabla,
      columna: cfg.columna,
      accion: cfg.accion,
      descripcion: cfg.descripcion,
      candidatos,
      aplicados: 0,
    }));
  }

  const resultados: ResultadoLimpiezaTablaHuerfanoProdTienda[] = [];

  await prisma.$transaction(async () => {
    for (const { cfg, candidatos } of candidatosPorTabla) {
      const aplicados =
        candidatos > 0 ? await aplicarLimpiezaTabla(cfg) : 0;
      resultados.push({
        tabla: cfg.tabla,
        columna: cfg.columna,
        accion: cfg.accion,
        descripcion: cfg.descripcion,
        candidatos,
        aplicados: Number(aplicados),
      });
    }
  });

  return resultados;
}
