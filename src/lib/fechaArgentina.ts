/**
 * Formateo de fechas/horas en zona horaria de negocio: Argentina (UTC−3, sin DST).
 * Usar siempre en PDFs, nombres de archivo y UI que deban coincidir con hora local AR
 * aunque el servidor esté en UTC (p. ej. Vercel) o el usuario tenga otra zona en el navegador.
 */
export const TIMEZONE_ARGENTINA = "America/Argentina/Buenos_Aires" as const;

type PartMap = Record<string, string>;

function toPartMap(d: Date, options: Intl.DateTimeFormatOptions): PartMap {
  const parts = new Intl.DateTimeFormat("es-AR", {
    ...options,
    timeZone: TIMEZONE_ARGENTINA,
  }).formatToParts(d);
  const m: PartMap = {};
  for (const x of parts) {
    if (x.type !== "literal") m[x.type] = x.value;
  }
  return m;
}

/** Ej. `25/03 14:30` — PDF, listados, modales. */
export function formatDdMmHhMmArgentina(d: Date): string {
  const m = toPartMap(d, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${m.day}/${m.month} ${m.hour}:${m.minute}`;
}

/** Encabezado tipo nota de pedido: `miércoles 25 de marzo de 2026`. */
export function formatFechaLargaNotaPedidoArgentina(d: Date): string {
  const weekday = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_ARGENTINA,
    weekday: "long",
  }).format(d);
  const day = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_ARGENTINA,
    day: "numeric",
  }).format(d);
  const month = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_ARGENTINA,
    month: "long",
  }).format(d);
  const year = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_ARGENTINA,
    year: "numeric",
  }).format(d);
  return `${weekday} ${day} de ${month} de ${year}`;
}

/** Fecha y hora legible para impresión / pie de página. */
export function formatFechaHoraCompletaArgentina(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_ARGENTINA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(/\s*,\s*/g, " ")
    .trim();
}

/** Solo fecha (`dd/mm/aaaa`) en zona Argentina. */
export function formatFechaCortaArgentina(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_ARGENTINA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Sello PDF resumen aumentos Px: `02-06 14-30` (día-mes y hora-minuto, sin año). */
export function formatDdMmHhMmResumenAumentosArgentina(d: Date): string {
  const m = toPartMap(d, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${m.day}-${m.month} ${m.hour}-${m.minute}`;
}

/** Sello para nombres de archivo: `25-03-26 14:30`. */
export function formatDdMmYyHhMmNombreArchivoArgentina(d: Date): string {
  const m = toPartMap(d, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${m.day}-${m.month}-${m.year} ${m.hour}:${m.minute}`;
}

/**
 * Partes de una fecha calendario `YYYY-MM-DD` (sin hora). Null si el texto no es un día gregoriano válido.
 * Usar en payloads de facturación / ARCA; no interpretar TZ del runtime.
 */
export function parseIsoYmdParts(
  isoYmd: string
): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoYmd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return { y, m: mo, d };
}

/** Medianoche+12h UTC para persistir columnas Prisma `@db.Date` desde `YYYY-MM-DD`. */
export function prismaDateOnlyFromIsoYmd(isoYmd: string): Date | null {
  const p = parseIsoYmdParts(isoYmd);
  if (!p) return null;
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 12, 0, 0));
}

/** `YYYY-MM-DD` → `YYYYMMDD` (CbteFch / CAEFchVto ARCA). */
export function isoYmdToYyyymmdd(isoYmd: string): string | null {
  const p = parseIsoYmdParts(isoYmd);
  if (!p) return null;
  return `${p.y}${String(p.m).padStart(2, "0")}${String(p.d).padStart(2, "0")}`;
}

/** `YYYYMMDD` ARCA → `YYYY-MM-DD`. */
export function yyyymmddToIsoYmd(yyyymmdd: string): string | null {
  const t = yyyymmdd.trim();
  if (!/^\d{8}$/.test(t)) return null;
  return parseIsoYmdParts(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`)
    ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`
    : null;
}

/**
 * Calendario gregoriano en Argentina a partir de un instante UTC (p. ej. `generadoAt` de Prisma).
 * `YYYY-MM-DD` para inputs `type="date"` y exportaciones DUX.
 */
export function dateToIsoYmdArgentina(d: Date): string {
  const m = toPartMap(d, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return `${m.year}-${m.month}-${m.day}`;
}

/**
 * `YYYY-MM-DD` desde un `Date` de Prisma para columnas `@db.Date`.
 * El driver suele exponer el día de calendario persistido como medianoche **UTC**
 * (p. ej. `2026-05-15` en PostgreSQL → `2026-05-15T00:00:00.000Z`).
 * **No** usar {@link dateToIsoYmdArgentina} sobre ese valor: en Argentina (UTC−3) serían
 * las 21:00 del día **anterior** y el resultado sería un día menos (bug en inputs `type="date"`).
 */
export function isoYmdFromPrismaDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isoYmdToUtcNoonMs(isoYmd: string): number | null {
  const [y, m, d] = isoYmd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return Date.UTC(y, m - 1, d, 12, 0, 0);
}

/** Suma días calendario a `YYYY-MM-DD` (negocio en `TIMEZONE_ARGENTINA`). */
export function addDaysToIsoYmdArgentina(isoYmd: string, deltaDays: number): string {
  const utc = isoYmdToUtcNoonMs(isoYmd);
  if (utc == null) return isoYmd;
  const next = new Date(utc + deltaDays * 86400000);
  return dateToIsoYmdArgentina(next);
}

/** Días calendario (`toIso` − `fromIso`) sobre `YYYY-MM-DD` de negocio. */
export function diffCalendarDaysIsoYmdArgentina(fromIso: string, toIso: string): number | null {
  const from = isoYmdToUtcNoonMs(fromIso);
  const to = isoYmdToUtcNoonMs(toIso);
  if (from == null || to == null) return null;
  return Math.round((to - from) / 86400000);
}

/** Etiqueta de mes para tablas: `MARZO 2026` (nombre del mes en mayúsculas + año). */
export function formatMesAnioMayusculasDesdeIsoYmd(isoYmd: string): string {
  const [y, m, d] = isoYmd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const mes = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_ARGENTINA,
    month: "long",
  }).format(dt);
  const anio = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_ARGENTINA,
    year: "numeric",
  }).format(dt);
  return `${mes.toLocaleUpperCase("es-AR")} ${anio}`;
}

/** Ej. `ABRIL 1` — mes en mayúsculas + día del mes (calendario Argentina). */
export function formatMesDiaMayusculasDesdeIsoYmd(isoYmd: string): string {
  const [y, m, d] = isoYmd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const mes = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_ARGENTINA,
    month: "long",
  })
    .format(dt)
    .toLocaleUpperCase("es-AR");
  const dia = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_ARGENTINA,
    day: "numeric",
  }).format(dt);
  return `${mes} ${dia}`;
}

/** `2026-03-15` → `15/03/2026` (solo presentación). */
export function formatIsoYmdDdMmYyyyArgentina(isoYmd: string): string {
  const [y, m, d] = isoYmd.split("-");
  if (!y || !m || !d) return isoYmd;
  return `${d}/${m}/${y}`;
}

/** `2026-03-15` → `15/03/26` (pegado DUX: Fecha `dd/mm/aa`). */
export function formatIsoYmdDdMmYyArgentina(isoYmd: string): string {
  const [y, m, d] = isoYmd.split("-");
  if (!y || !m || !d) return isoYmd;
  return `${d}/${m}/${y.slice(-2)}`;
}

/**
 * `15/03/2026` → `2026-03-15`. Vacío si el texto no es una fecha calendario válida (`dd/mm/aaaa`).
 */
export function parseDdMmYyyyToIsoYmdArgentina(fechaDdMmYyyy: string): string {
  const t = fechaDdMmYyyy.trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return "";
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!Number.isFinite(d) || !Number.isFinite(mo) || !Number.isFinite(y)) return "";
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Solo dígitos (máx. 8) → fragmento `dd/mm/aaaa` para tipeo asistido. */
export function maskDigitsToDdMmYyyyDisplay(digits: string): string {
  const only = digits.replace(/\D/g, "").slice(0, 8);
  if (only.length <= 2) return only;
  if (only.length <= 4) return `${only.slice(0, 2)}/${only.slice(2)}`;
  return `${only.slice(0, 2)}/${only.slice(2, 4)}/${only.slice(4)}`;
}

const MS_CALENDARIO_DIA = 86_400_000;

/**
 * Días calendario entre `desdeIso` y `hastaIso` (solo `YYYY-MM-DD`), ambas en zona de negocio Argentina.
 * Si `hastaIso` es anterior a `desdeIso`, devuelve `null`. Si coinciden, `0`.
 */
function diasCalendarioDesdeHastaIsoYmdArgentina(
  desdeIso: string,
  hastaIso: string
): number | null {
  const [ya, ma, da] = desdeIso.split("-").map(Number);
  const [yh, mh, dh] = hastaIso.split("-").map(Number);
  if (![ya, ma, da, yh, mh, dh].every((n) => Number.isFinite(n))) return null;
  const t0 = Date.UTC(ya, ma - 1, da);
  const t1 = Date.UTC(yh, mh - 1, dh);
  if (t1 < t0) return null;
  return Math.round((t1 - t0) / MS_CALENDARIO_DIA);
}

/**
 * Días calendario (Argentina): fecha de acreditación menos hoy (`YYYY-MM-DD`).
 * Positivo si la acreditación es futura; `0` si es hoy; negativo si ya pasó.
 * `NaN` si `fechaAcreditacionIso` no es una fecha válida.
 */
export function diasNumericosAcreditacionMenosHoyArgentina(fechaAcreditacionIso: string): number {
  const hoy = dateToIsoYmdArgentina(new Date());
  const futuroHasta = diasCalendarioDesdeHastaIsoYmdArgentina(hoy, fechaAcreditacionIso);
  if (futuroHasta !== null) return futuroHasta;
  const diasPasados = diasCalendarioDesdeHastaIsoYmdArgentina(fechaAcreditacionIso, hoy);
  if (diasPasados === null) return Number.NaN;
  return diasPasados === 0 ? 0 : -diasPasados;
}

/**
 * Igual que {@link diasNumericosAcreditacionMenosHoyArgentina} en texto; vacío si no es fecha válida.
 */
export function diasTextoAcreditacionMenosHoyArgentina(fechaAcreditacionIso: string): string {
  const n = diasNumericosAcreditacionMenosHoyArgentina(fechaAcreditacionIso);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

/**
 * Cheque de tesorería: la fecha de acreditación (`YYYY-MM-DD`, calendario Argentina) ya llegó o es hoy.
 * Coincide con la regla del backend que rechaza si la fecha es posterior a hoy en Argentina.
 */
export function chequePuedeAcreditarsePorFechaArgentina(fechaAcreditacionIso: string): boolean {
  const hoy = dateToIsoYmdArgentina(new Date());
  return fechaAcreditacionIso <= hoy;
}

/** Sello `dd_mm hh_mm` para nombre de archivo de recepción. */
export function formatDdMmHhMmGuionesBajosArchivoArgentina(d: Date): string {
  const m = toPartMap(d, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${m.day}_${m.month} ${m.hour}_${m.minute}`;
}
