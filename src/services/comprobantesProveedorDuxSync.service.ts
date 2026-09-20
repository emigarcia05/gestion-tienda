import { Prisma } from "@prisma/client";
import { fetchComprasPagesAcumulado } from "@/lib/duxComprasApi";
import type { CompraDux } from "@/lib/duxComprasApi";
import { dateToIsoYmdArgentina } from "@/lib/fechaArgentina";
import {
  setSyncComprasProveedorDuxErrorInDb,
  setSyncComprasProveedorDuxProgressInDb,
  setSyncComprasProveedorDuxSuccessInDb,
  startSyncComprasProveedorDuxInDb,
} from "@/lib/syncComprasProveedorDuxStatusDb";
import { prisma } from "@/lib/prisma";
import { revalidatePedidoUrgenteTrasCambioIvaSaldo } from "@/lib/revalidatePedidoUrgenteTrasCambioIvaSaldo";
import type { ServiceResult } from "@/types";

const DUX_ID_EMPRESA_COMPRAS_DEFAULT = 2482;

/** Ventana fija de compras DUX para consulta y retención. */
const DIAS_VENTANA_COMPRAS_DUX = 150;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Resta `dias` al calendario de **hoy en Argentina** (`dateToIsoYmdArgentina`),
 * sin depender del huso del servidor para el día de negocio.
 */
function fechaArgentinaMenosDiasComoDux(dias: number): string {
  const isoHoy = dateToIsoYmdArgentina(new Date());
  const [ys, ms, ds] = isoHoy.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return "01/01/1970";
  }
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - dias);
  return `${pad2(t.getUTCDate())}/${pad2(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}`;
}

/**
 * Suma `dias` al calendario de **hoy en Argentina** (`dateToIsoYmdArgentina`),
 * sin depender del huso del servidor para el día de negocio.
 */
function fechaArgentinaMasDiasComoDux(dias: number): string {
  const isoHoy = dateToIsoYmdArgentina(new Date());
  const [ys, ms, ds] = isoHoy.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return "01/01/1970";
  }
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + dias);
  return `${pad2(t.getUTCDate())}/${pad2(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}`;
}

/** Inicio del día (UTC) usado como límite: `fecha_comp` estrictamente menor → más de `dias` días de antigüedad vs hoy AR. */
function fechaLimiteRetencionComprasDux(dias: number): Date {
  const isoHoy = dateToIsoYmdArgentina(new Date());
  const [ys, ms, ds] = isoHoy.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - dias);
  return t;
}

function parseDuxDdMmYyyyToDate(s: string): Date | null {
  const t = s.trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

function duxComprasMinIntervalMs(): number {
  const raw = process.env.DUX_COMPRAS_MIN_INTERVAL_MS;
  if (raw == null || raw === "") return 5000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 5000;
}

/** Segundos aproximados por sucursal pendiente (pausa DUX + consulta + persistencia). */
export function syncComprasSecondsPerSucursalEstimate(): number {
  return duxComprasMinIntervalMs() / 1000 + 8;
}

/** ETA en segundos según sucursales restantes (`processed` / `total` en BD). */
export function estimateSyncComprasRemainingSeconds(
  processed: number,
  total: number,
  running: boolean
): number {
  if (!running) return 0;
  const remaining = Math.max(0, total - processed);
  return remaining * syncComprasSecondsPerSucursalEstimate();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toMoney(raw: string | undefined): Prisma.Decimal | null {
  const rawText = String(raw ?? "").trim();
  if (!rawText) return null;

  // Soporta formatos con punto/coma (ej. "504366.84", "504.366,84", "504366,84").
  const compact = rawText.replace(/\s+/g, "");
  const lastDot = compact.lastIndexOf(".");
  const lastComma = compact.lastIndexOf(",");

  let normalized = compact;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const thousandSeparator = decimalSeparator === "." ? "," : ".";
    normalized = compact.split(thousandSeparator).join("");
    if (decimalSeparator === ",") normalized = normalized.replace(",", ".");
  } else if (lastComma >= 0) {
    normalized = compact.replace(",", ".");
  }

  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n)) return null;
  return new Prisma.Decimal(n.toFixed(2));
}

function mapCompraToUpsert(
  c: CompraDux,
  idSucursalQuery: number,
  provSet: Set<string>
):
  | { ok: false }
  | {
      ok: true;
      data: {
        where: {
          idSucursalEmpresa: string;
          tipoComp: string;
          comprobante: string;
          fechaComp: Date;
          idProveedor: string;
        };
        create: {
          idSucursalEmpresa: string;
          tipoComp: string;
          comprobante: string;
          fechaComp: Date;
          idProveedor: string;
          total: Prisma.Decimal;
          montoAplicado: Prisma.Decimal;
        };
        update: { total: Prisma.Decimal; montoAplicado: Prisma.Decimal };
      };
    } {
  const comprobante = (c.comprobante ?? "").trim();
  if (!comprobante) return { ok: false };

  const tipoComp = (c.tipoComp ?? "").trim();
  if (!tipoComp) return { ok: false };

  const idProveedor = (c.idProveedor ?? "").trim();
  if (!idProveedor || !provSet.has(idProveedor)) return { ok: false };

  const fechaStr = (c.fechaComp ?? "").trim();
  const fechaComp = parseDuxDdMmYyyyToDate(fechaStr);
  if (!fechaComp) return { ok: false };

  const idSucursalEmpresa = (c.idSucursalEmpresa ?? c.idSucursal ?? String(idSucursalQuery)).trim();
  if (!idSucursalEmpresa) return { ok: false };

  const total = toMoney(c.total);
  const montoAplicado = toMoney(c.montoAplicado);
  if (!total || !montoAplicado) return { ok: false };

  return {
    ok: true,
    data: {
      where: {
        idSucursalEmpresa,
        tipoComp,
        comprobante,
        fechaComp,
        idProveedor,
      },
      create: {
        idSucursalEmpresa,
        tipoComp,
        comprobante,
        fechaComp,
        idProveedor,
        total,
        montoAplicado,
      },
      update: { total, montoAplicado },
    },
  };
}

export interface SyncComprobantesProveedorDuxResult {
  fechaDesde: string;
  fechaHasta: string;
  idEmpresa: number;
  eliminadosAntiguos: number;
  upserts: number;
  omitidos: number;
  detalleSucursal: {
    idSucursal: number;
    filasApi: number;
    persistidas: number;
    error?: string;
  }[];
}

/**
 * Consulta `/compras` en DUX **una vez por sucursal** (`sucursales.id_dux`).
 * Usa ventana fija de consulta:
 * - `fechaDesde`: hoy AR − `DIAS_VENTANA_COMPRAS_DUX` (150) días.
 * - `fechaHasta`: hoy AR + 1 día.
 * Al finalizar la persistencia, borra filas con `fecha_comp` menor o igual a `fechaDesde`.
 */
export async function sincronizarComprobantesProveedorDesdeDux(params?: {
  idEmpresa?: number;
}): Promise<ServiceResult<SyncComprobantesProveedorDuxResult>> {
  const idEmpresa =
    params?.idEmpresa ??
    (process.env.DUX_ID_EMPRESA_COMPRAS
      ? Number(process.env.DUX_ID_EMPRESA_COMPRAS)
      : DUX_ID_EMPRESA_COMPRAS_DEFAULT);

  if (!Number.isFinite(idEmpresa) || idEmpresa <= 0 || idEmpresa > 99_999_999) {
    return { success: false, error: "ID empresa DUX inválido." };
  }

  let comprasSyncEnCurso = false;
  try {
    const fechaDesde = fechaArgentinaMenosDiasComoDux(DIAS_VENTANA_COMPRAS_DUX);
    const fechaHasta = fechaArgentinaMasDiasComoDux(1);
    const limite = fechaLimiteRetencionComprasDux(DIAS_VENTANA_COMPRAS_DUX);

    const sucursalIdDux = (
      await prisma.sucursal.findMany({
        select: { idDux: true },
      })
    )
      .map((s) => (s.idDux ?? "").trim())
      .filter((id) => /^\d+$/.test(id))
      .map((id) => Number(id));

    if (sucursalIdDux.length === 0) {
      return { success: false, error: "No hay sucursales con id_dux numérico." };
    }

    const provSet = new Set(
      (
        await prisma.proveedor.findMany({
          where: { idProveedorDux: { not: null } },
          select: { idProveedorDux: true },
        })
      )
        .map((p) => (p.idProveedorDux ?? "").trim())
        .filter(Boolean)
    );

    const intervalMs = duxComprasMinIntervalMs();
    let upserts = 0;
    let omitidos = 0;
    const detalleSucursal: SyncComprobantesProveedorDuxResult["detalleSucursal"] = [];

    const totalSucursales = sucursalIdDux.length;
    await startSyncComprasProveedorDuxInDb(totalSucursales);
    comprasSyncEnCurso = true;
    await setSyncComprasProveedorDuxProgressInDb(0, totalSucursales);

    for (let i = 0; i < sucursalIdDux.length; i++) {
      const idSucursal = sucursalIdDux[i];
      if (i > 0 && intervalMs > 0) {
        await delay(intervalMs);
      }

      try {
        const compras = await fetchComprasPagesAcumulado({
          fechaDesde,
          fechaHasta,
          idEmpresa,
          idSucursal,
        });

        let persistidas = 0;
        for (const c of compras) {
          const mapped = mapCompraToUpsert(c, idSucursal, provSet);
          if (!mapped.ok) {
            omitidos += 1;
            continue;
          }
          await prisma.comprobanteProveedor.upsert({
            where: {
              idSucursalEmpresa_tipoComp_comprobante_fechaComp_idProveedor: mapped.data.where,
            },
            create: mapped.data.create,
            update: mapped.data.update,
          });
          upserts += 1;
          persistidas += 1;
        }

        detalleSucursal.push({
          idSucursal,
          filasApi: compras.length,
          persistidas,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al consultar DUX.";
        detalleSucursal.push({
          idSucursal,
          filasApi: 0,
          persistidas: 0,
          error: msg,
        });
      }

      await setSyncComprasProveedorDuxProgressInDb(i + 1, totalSucursales);
    }

    const purga = await prisma.comprobanteProveedor.deleteMany({
      where: { fechaComp: { lte: limite } },
    });
    const eliminadosAntiguos = purga.count;

    await setSyncComprasProveedorDuxSuccessInDb(totalSucursales, totalSucursales);
    comprasSyncEnCurso = false;

    revalidatePedidoUrgenteTrasCambioIvaSaldo();

    return {
      success: true,
      data: {
        fechaDesde,
        fechaHasta,
        idEmpresa,
        eliminadosAntiguos,
        upserts,
        omitidos,
        detalleSucursal,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al sincronizar comprobantes.";
    if (comprasSyncEnCurso) {
      try {
        await setSyncComprasProveedorDuxErrorInDb(msg);
      } catch {
        // Evita enmascarar el error original si falla el update de estado.
      }
    }
    return { success: false, error: msg };
  }
}
