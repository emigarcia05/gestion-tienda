/**
 * Administrador · COBROS & DESC. · Seguimiento Fiscal (solo lectura).
 * Suma el monto bruto de los cobros del mes cuyo vínculo `cobros_vinc_cajas`
 * (forma × entidad × sucursal) tiene `seguimiento_fiscal = true`, agrupado por el titular
 * del punto de venta del comprobante cobrado (`vtas_comprobantes.pto_vta_id` → `ptos_vtas.titular`).
 */
import { clavePeriodoEstPorProd, parseClavePeriodoEstPorProd } from "@/lib/estPorProdPeriodo";
import { prisma } from "@/lib/prisma";
import { seguimientoFiscalParamsSchema } from "@/lib/validations/seguimientoFiscal";
import {
  opcionesPeriodoCx,
  rangoFechaPeriodoCx,
  type OpcionFiltroCxMercVend,
} from "@/services/balCxMercaderia.service";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";

export interface FilaSeguimientoFiscalForma {
  /** `pagoId|entidadId` (entidad vacía si la forma no tiene). */
  clave: string;
  formaNombre: string;
  /** Vacío si la forma no tiene entidad. */
  entidadNombre: string;
  cantidad: number;
  /** Σ `tesoreria_movimientos.monto` (bruto). */
  monto: number;
}

export interface GrupoSeguimientoFiscalTitular {
  /** `null` = cobros sin comprobante (anticipo CC sin imputar). */
  titular: string | null;
  /** N° de los puntos de venta del titular que tuvieron cobros en el mes. */
  ptosVenta: string[];
  formas: FilaSeguimientoFiscalForma[];
  total: number;
}

export interface SeguimientoFiscalData {
  /** Titulares A→Z; el grupo sin punto de venta va último. */
  grupos: GrupoSeguimientoFiscalTitular[];
  total: number;
  periodos: OpcionFiltroCxMercVend[];
  /** Mes calendario AR actual (`YYYY-MM`): valor al limpiar FECHA. */
  periodoDefault: string;
  filtros: { periodo: string };
}

function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
}

export async function listarSeguimientoFiscalData(raw: {
  periodo?: string;
}): Promise<SeguimientoFiscalData> {
  const actual = mesAnioCalendarioArgentina();
  const periodoDefault = clavePeriodoEstPorProd(actual.mes, actual.anio);
  const parsed = seguimientoFiscalParamsSchema.safeParse({ periodo: raw.periodo || periodoDefault });
  const periodo =
    (parsed.success ? parseClavePeriodoEstPorProd(parsed.data.periodo) : null) ?? actual;
  const rango = rangoFechaPeriodoCx(periodo);
  const whereCobro = { catMovimiento: "COBRO", tipoMovimiento: "INGRESO" } as const;

  const [agg, vinculos] = await Promise.all([
    prisma.tesoreriaMovimiento.aggregate({
      where: whereCobro,
      _min: { fechaRegistro: true },
      _max: { fechaRegistro: true },
    }),
    prisma.cobrosPorSucursal.findMany({
      where: { seguimientoFiscal: true },
      select: { pagoId: true, entidadId: true, sucursalId: true },
    }),
  ]);

  const movimientos =
    vinculos.length === 0
      ? []
      : await prisma.tesoreriaMovimiento.findMany({
          where: {
            ...whereCobro,
            fechaRegistro: rango,
            OR: vinculos.map((v) => ({
              pagoId: v.pagoId,
              entidadId: v.entidadId,
              sucursalId: v.sucursalId,
            })),
          },
          select: {
            monto: true,
            pagoId: true,
            entidadId: true,
            pago: { select: { nombre: true } },
            entidad: { select: { nombre: true } },
            comprobante: {
              select: { ptoVta: { select: { ptoVenta: true, titular: true } } },
            },
          },
        });

  const grupos = new Map<
    string,
    { titular: string | null; ptosVenta: Set<string>; formas: Map<string, FilaSeguimientoFiscalForma> }
  >();
  let total = 0;
  for (const m of movimientos) {
    const ptoVta = m.comprobante?.ptoVta ?? null;
    const titular = ptoVta ? ptoVta.titular.toLocaleUpperCase("es-AR") : null;
    const claveGrupo = titular ?? "";
    let grupo = grupos.get(claveGrupo);
    if (!grupo) {
      grupo = { titular, ptosVenta: new Set(), formas: new Map() };
      grupos.set(claveGrupo, grupo);
    }
    if (ptoVta) grupo.ptosVenta.add(ptoVta.ptoVenta);

    const claveForma = `${m.pagoId ?? ""}|${m.entidadId ?? ""}`;
    let forma = grupo.formas.get(claveForma);
    if (!forma) {
      forma = {
        clave: claveForma,
        formaNombre: (m.pago?.nombre ?? "").toLocaleUpperCase("es-AR"),
        entidadNombre: (m.entidad?.nombre ?? "").toLocaleUpperCase("es-AR"),
        cantidad: 0,
        monto: 0,
      };
      grupo.formas.set(claveForma, forma);
    }
    forma.cantidad += 1;
    forma.monto += m.monto;
    total += m.monto;
  }

  const listaGrupos: GrupoSeguimientoFiscalTitular[] = [...grupos.values()]
    .map((g) => {
      const formas = [...g.formas.values()].sort(
        (a, b) =>
          compararTexto(a.formaNombre, b.formaNombre) ||
          compararTexto(a.entidadNombre, b.entidadNombre)
      );
      return {
        titular: g.titular,
        ptosVenta: [...g.ptosVenta].sort(compararTexto),
        formas,
        total: formas.reduce((acc, f) => acc + f.monto, 0),
      };
    })
    .sort((a, b) => {
      if (a.titular == null) return b.titular == null ? 0 : 1;
      if (b.titular == null) return -1;
      return compararTexto(a.titular, b.titular);
    });

  return {
    grupos: listaGrupos,
    total,
    periodos: opcionesPeriodoCx(agg._min.fechaRegistro, agg._max.fechaRegistro, actual),
    periodoDefault,
    filtros: { periodo: clavePeriodoEstPorProd(periodo.mes, periodo.anio) },
  };
}
