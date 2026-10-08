/**
 * Plan de pago de comprobantes de mercadería: hasta 4 cuotas iguales.
 * Pagos (`monto_aplicado`) se aplican FIFO a las cuotas 1→4.
 */

export const PLAZOS_PAGO_DIAS_PERMITIDOS = [30, 60, 90, 120, 150] as const;
export type PlazoPagoDiasPermitido = (typeof PLAZOS_PAGO_DIAS_PERMITIDOS)[number];

export type PlanPlazosPago = {
  plazo1: number | null;
  plazo2: number | null;
  plazo3: number | null;
  plazo4: number | null;
};

export type CuotaVencimiento = {
  nro: number;
  dias: number;
  fechaVencIso: string;
  montoCuota: number;
  montoAplicadoCuota: number;
  saldoCuota: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Plazos efectivos no nulos en orden (1.º default 30 si falta). */
export function resolverPlazosEfectivos(
  override: PlanPlazosPago | null | undefined,
  proveedor: PlanPlazosPago | null | undefined
): number[] {
  const usaOverride = override?.plazo1 != null;
  const src = usaOverride ? override! : (proveedor ?? { plazo1: null, plazo2: null, plazo3: null, plazo4: null });
  const p1 = src.plazo1 ?? 30;
  const out = [p1];
  if (src.plazo2 != null) out.push(src.plazo2);
  if (src.plazo3 != null) out.push(src.plazo3);
  if (src.plazo4 != null) out.push(src.plazo4);
  return out;
}

export function montosCuotasIguales(total: number, n: number): number[] {
  if (n < 1) return [];
  if (n === 1) return [round2(total)];
  const base = round2(total / n);
  const montos: number[] = [];
  let acum = 0;
  for (let i = 0; i < n - 1; i++) {
    montos.push(base);
    acum = round2(acum + base);
  }
  montos.push(round2(total - acum));
  return montos;
}

function addDaysIso(fechaCompIso: string, dias: number): string {
  const iso = fechaCompIso.slice(0, 10);
  const [ys, ms, ds] = iso.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + Math.max(1, dias));
  return t.toISOString().slice(0, 10);
}

/**
 * Expande un comprobante en cuotas con aplicación FIFO de `montoAplicado`.
 * Solo incluye cuotas con `saldoCuota > 0` si `soloConSaldo` (default true).
 */
export function expandirCuotasComprobante(params: {
  fechaCompIso: string;
  total: number;
  montoAplicado: number;
  override?: PlanPlazosPago | null;
  proveedor?: PlanPlazosPago | null;
  soloConSaldo?: boolean;
}): CuotaVencimiento[] {
  const plazos = resolverPlazosEfectivos(params.override, params.proveedor);
  const montos = montosCuotasIguales(params.total, plazos.length);
  let restoPago = round2(Math.max(0, params.montoAplicado));
  const cuotas: CuotaVencimiento[] = [];

  for (let i = 0; i < plazos.length; i++) {
    const montoCuota = montos[i] ?? 0;
    const aplicado = round2(Math.min(montoCuota, Math.max(0, restoPago)));
    restoPago = round2(restoPago - aplicado);
    const saldoCuota = round2(montoCuota - aplicado);
    const nro = i + 1;
    const dias = plazos[i]!;
    cuotas.push({
      nro,
      dias,
      fechaVencIso: addDaysIso(params.fechaCompIso, dias),
      montoCuota,
      montoAplicadoCuota: aplicado,
      saldoCuota,
    });
  }

  if (params.soloConSaldo === false) return cuotas;
  return cuotas.filter((c) => c.saldoCuota > 0);
}

export function formatPlanPlazosLabel(plazos: number[]): string {
  return plazos.join(", ");
}

/**
 * CTE SQL `cuotas_mercaderia`: una fila por cuota con saldo &gt; 0.
 * Columnas: id, fecha_comp, nombre, id_proveedor_dux, nro_cuota, fecha_venc, saldo_cuota.
 *
 * Alias base: `c` comprobante, `p` proveedor.
 */
export const SQL_CTE_CUOTAS_MERCADERIA = `
cuotas_base AS (
  SELECT
    c.id,
    c.fecha_comp,
    c.total,
    c.monto_aplicado,
    p.nombre,
    p.id_proveedor_dux,
    CASE
      WHEN c.plazo_pago_1_dias IS NOT NULL THEN c.plazo_pago_1_dias
      ELSE COALESCE(p.plazo_pago_1_dias, 30)
    END AS p1,
    CASE
      WHEN c.plazo_pago_1_dias IS NOT NULL THEN c.plazo_pago_2_dias
      ELSE p.plazo_pago_2_dias
    END AS p2,
    CASE
      WHEN c.plazo_pago_1_dias IS NOT NULL THEN c.plazo_pago_3_dias
      ELSE p.plazo_pago_3_dias
    END AS p3,
    CASE
      WHEN c.plazo_pago_1_dias IS NOT NULL THEN c.plazo_pago_4_dias
      ELSE p.plazo_pago_4_dias
    END AS p4
  FROM fin_compras_comprobante c
  INNER JOIN proveedores p ON p.id_proveedor_dux = c.id_proveedor
  WHERE c.total > c.monto_aplicado
),
cuotas_n AS (
  SELECT
    b.*,
    (
      1
      + CASE WHEN b.p2 IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN b.p3 IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN b.p4 IS NOT NULL THEN 1 ELSE 0 END
    )::int AS n_plazos
  FROM cuotas_base b
),
cuotas_expand AS (
  SELECT
    n.id,
    n.fecha_comp,
    n.nombre,
    n.id_proveedor_dux,
    n.total,
    n.monto_aplicado,
    n.n_plazos,
    gs.nro,
    CASE gs.nro
      WHEN 1 THEN n.p1
      WHEN 2 THEN n.p2
      WHEN 3 THEN n.p3
      WHEN 4 THEN n.p4
    END AS dias,
    CASE
      WHEN gs.nro < n.n_plazos THEN ROUND(n.total / n.n_plazos, 2)
      ELSE n.total - ROUND(n.total / n.n_plazos, 2) * (n.n_plazos - 1)
    END AS monto_cuota
  FROM cuotas_n n
  CROSS JOIN generate_series(1, 4) AS gs(nro)
  WHERE
    (gs.nro = 1)
    OR (gs.nro = 2 AND n.p2 IS NOT NULL)
    OR (gs.nro = 3 AND n.p3 IS NOT NULL)
    OR (gs.nro = 4 AND n.p4 IS NOT NULL)
),
cuotas_fifo AS (
  SELECT
    e.*,
    COALESCE(
      SUM(e.monto_cuota) OVER (
        PARTITION BY e.id
        ORDER BY e.nro
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) AS acum_antes
  FROM cuotas_expand e
),
cuotas_mercaderia AS (
  SELECT
    f.id,
    f.fecha_comp,
    f.nombre,
    f.id_proveedor_dux,
    f.nro AS nro_cuota,
    (f.fecha_comp::date + GREATEST(1, f.dias))::date AS fecha_venc,
    GREATEST(
      0,
      f.monto_cuota - LEAST(f.monto_cuota, GREATEST(0, f.monto_aplicado - f.acum_antes))
    )::numeric(14, 2) AS saldo_cuota
  FROM cuotas_fifo f
)
`;
