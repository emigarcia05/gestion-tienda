import type { ClienteTipo, EnviosDepartamento, EnviosFormaPagado } from "@prisma/client";

export const CLIENTE_TIPO_VALUES = ["CONSUMIDOR_FINAL", "PINTOR"] as const;
export type ClienteTipoValue = (typeof CLIENTE_TIPO_VALUES)[number];

export const ENVIOS_FORMA_PAGADO_VALUES = [
  "PAGADO",
  "EFECTIVO",
  "TRANSFERENCIA",
  "POSNET",
  "CUENTA_CORRIENTE",
] as const;
export type EnviosFormaPagadoValue = (typeof ENVIOS_FORMA_PAGADO_VALUES)[number];

export const CLIENTE_TIPO_LABELS: Record<ClienteTipo, string> = {
  CONSUMIDOR_FINAL: "CONSUMIDOR FINAL",
  PINTOR: "PINTOR",
};

export const ENVIOS_DEPARTAMENTO_VALUES = [
  "CIUDAD",
  "LAS_HERAS",
  "GODOY_CRUZ",
  "GUAYMALLEN",
  "MAIPU",
  "LUJAN",
] as const;
export type EnviosDepartamentoValue = (typeof ENVIOS_DEPARTAMENTO_VALUES)[number];

export const ENVIOS_DEPARTAMENTO_LABELS: Record<EnviosDepartamento, string> = {
  CIUDAD: "CIUDAD",
  LAS_HERAS: "LAS HERAS",
  GODOY_CRUZ: "GODOY CRUZ",
  GUAYMALLEN: "GUAYMALLEN",
  MAIPU: "MAIPU",
  LUJAN: "LUJAN",
};

export function etiquetaDepartamentoEnvio(departamento: EnviosDepartamento | null): string {
  return departamento ? ENVIOS_DEPARTAMENTO_LABELS[departamento] : "";
}

export const ENVIOS_FORMA_PAGADO_LABELS: Record<EnviosFormaPagado, string> = {
  PAGADO: "PAGADO",
  EFECTIVO: "EFECTIVO",
  TRANSFERENCIA: "TRANSFERENCIA",
  POSNET: "POSNET",
  CUENTA_CORRIENTE: "CUENTA CORRIENTE",
};

/** Rango horario de envío: 09:00 a 19:00, saltos de 30 minutos. */
export const ENVIOS_HORA_VALUES = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
] as const;
export type EnviosHoraValue = (typeof ENVIOS_HORA_VALUES)[number];

export const ENVIOS_PDF_MAX_BYTES = 5 * 1024 * 1024;

export function esHoraEnvioValida(value: string): value is EnviosHoraValue {
  return (ENVIOS_HORA_VALUES as readonly string[]).includes(value);
}

export function esFormaPagadoEnvioValida(value: string): value is EnviosFormaPagadoValue {
  return (ENVIOS_FORMA_PAGADO_VALUES as readonly string[]).includes(value);
}

/** `PAGADO` como forma siempre marca el envío como pagado. */
export function pagadoDesdeFormaPagado(
  forma: EnviosFormaPagadoValue,
  pagado: boolean
): boolean {
  return forma === "PAGADO" || pagado;
}

/** `desde` no puede ser 19:00: hace falta un `hasta` posterior. */
export function horasDesdeDisponibles(): EnviosHoraValue[] {
  return ENVIOS_HORA_VALUES.filter((h) => h !== "19:00");
}

export function horasHastaDisponibles(horaDesde: string): EnviosHoraValue[] {
  return ENVIOS_HORA_VALUES.filter((h) => h > horaDesde);
}

export function etiquetaHorarioEnvio(horaDesde: string, horaHasta: string): string {
  return `${horaDesde} – ${horaHasta}`;
}

export function etiquetaTipoCliente(tipo: ClienteTipo): string {
  return CLIENTE_TIPO_LABELS[tipo];
}

export function etiquetaFormaPagadoEnvio(forma: EnviosFormaPagado): string {
  return ENVIOS_FORMA_PAGADO_LABELS[forma];
}

/** `clientes.nombre_completo` se persiste y muestra en mayúsculas. */
export function normalizarNombreCliente(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

/** Solo dígitos (CEL / CUIT sin máscara). */
export function soloDigitos(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Máscara visual de CUIT `##-########-#` (hasta 11 dígitos).
 * Persistencia: usar `soloDigitos`.
 */
export function formatearCuitMascara(value: string): string {
  const d = soloDigitos(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** CEL: sin guiones ni espacios (solo dígitos). */
export function normalizarCelCliente(value: string): string {
  return soloDigitos(value);
}

export function nombreCompletoCliente(cliente: {
  nombreCompleto: string;
}): string {
  return normalizarNombreCliente(cliente.nombreCompleto);
}

export function esConsumidorFinalSinNombre(cliente: {
  tipo: ClienteTipo;
  nombreCompleto: string;
}): boolean {
  return cliente.tipo === "CONSUMIDOR_FINAL" && normalizarNombreCliente(cliente.nombreCompleto) === "";
}

export function etiquetaClienteListado(cliente: {
  tipo: ClienteTipo;
  nombreCompleto: string;
  cel: string;
}): string {
  if (esConsumidorFinalSinNombre(cliente)) {
    const cel = cliente.cel.trim();
    return cel ? `CONS. FINAL - ${cel}` : "CONS. FINAL";
  }
  return nombreCompletoCliente(cliente);
}

export function partesNombreClienteListado(cliente: {
  tipo: ClienteTipo;
  nombreCompleto: string;
  cel: string;
}): { principal: string; sufijo?: string } {
  if (!esConsumidorFinalSinNombre(cliente)) {
    return { principal: nombreCompletoCliente(cliente) };
  }
  const cel = cliente.cel.trim();
  return cel ? { principal: "CONS. FINAL", sufijo: cel } : { principal: "CONS. FINAL" };
}

/**
 * Listados de clientes:
 * 1) con nombre (A-Z)
 * 2) sin nombre (CONS. FINAL), ordenados por cel.
 */
export function compararClientesParaListado(
  a: Pick<ClienteResumen, "nombreCompleto" | "cel" | "tipo">,
  b: Pick<ClienteResumen, "nombreCompleto" | "cel" | "tipo">
): number {
  const nombreA = normalizarNombreCliente(a.nombreCompleto);
  const nombreB = normalizarNombreCliente(b.nombreCompleto);
  const aTieneNombre = nombreA !== "";
  const bTieneNombre = nombreB !== "";

  if (aTieneNombre !== bTieneNombre) {
    return aTieneNombre ? -1 : 1;
  }

  if (aTieneNombre && bTieneNombre) {
    const byNombre = nombreA.localeCompare(nombreB, "es", { sensitivity: "base" });
    if (byNombre !== 0) return byNombre;
  }

  const celA = a.cel.trim();
  const celB = b.cel.trim();
  const byCel = celA.localeCompare(celB, "es", { sensitivity: "base" });
  if (byCel !== 0) return byCel;

  return 0;
}

/** Textos de `clientes_direcciones`: primera letra mayúscula, resto minúsculas (oración). */
export function capitalizarTextoEnvio(value: string): string {
  const t = value.trim().replace(/\s+/g, " ");
  if (t === "") return t;
  const lower = t.toLocaleLowerCase("es-AR");
  return lower.charAt(0).toLocaleUpperCase("es-AR") + lower.slice(1);
}

/** Misma regla mientras se escribe (sin recortar espacios al final). */
export function capitalizarTextoEnvioInput(value: string): string {
  if (value === "") return value;
  const first = value.charAt(0).toLocaleUpperCase("es-AR");
  const rest = value.slice(1).toLocaleLowerCase("es-AR");
  return first + rest;
}

function properPalabraEnvio(word: string): string {
  if (word === "") return word;
  const lower = word.toLocaleLowerCase("es-AR");
  return lower.charAt(0).toLocaleUpperCase("es-AR") + lower.slice(1);
}

/** `calle_nombre` y `distrito`: proper case (primera letra de cada palabra). */
export function properTextoEnvio(value: string): string {
  const t = value.trim().replace(/\s+/g, " ");
  if (t === "") return t;
  return t.split(" ").map(properPalabraEnvio).join(" ");
}

/** Proper case mientras se escribe (conserva espacios al final). */
export function properTextoEnvioInput(value: string): string {
  return value.replace(/[^ ]+/g, properPalabraEnvio);
}

export interface ClienteResumen {
  id: string;
  nombreCompleto: string;
  cel: string;
  tipo: ClienteTipo;
}

export interface ClienteItem extends ClienteResumen {
  pintorAsociadoId: string | null;
  pintorAsociado: ClienteResumen | null;
  /** CUIT 11 dígitos o null. */
  cuit: string | null;
  /** Código ARCA (`condicion_iva_cod_arca.codigo`) o null. */
  condicionIva: number | null;
}

/** Nombre del pintor asociado, solo si el cliente es CONSUMIDOR_FINAL y tiene uno. */
export function nombrePintorAsociadoCliente(cliente: ClienteItem): string | null {
  if (cliente.tipo !== "CONSUMIDOR_FINAL" || !cliente.pintorAsociado) return null;
  return nombreCompletoCliente(cliente.pintorAsociado);
}

export interface EnviosDireccionItem {
  id: string;
  personaId: string;
  /** Nombre del proyecto (MAYÚSCULAS). */
  nombreProyecto: string;
  calleNombre: string;
  numeracion: string;
  distrito: string;
  departamento: EnviosDepartamento | null;
  urlMaps: string;
  referencia: string;
}

/** Cliente del listado Facturación · Lista Clientes, con proyectos anidados. */
export interface ClienteListaItem extends ClienteItem {
  proyectos: EnviosDireccionItem[];
}

export interface EnviosSucursalOption {
  id: string;
  codigo: string;
  nombre: string;
}

export function etiquetaSucursalEnvio(sucursal: { nombre: string }): string {
  return sucursal.nombre.trim().toLocaleUpperCase("es-AR");
}

export interface EnviosFinalListItem {
  id: string;
  sucursal: EnviosSucursalOption;
  clienteFinal: ClienteItem | null;
  pintor: ClienteItem | null;
  direccion: EnviosDireccionItem;
  fechaEnvioIso: string;
  horaDesde: string;
  horaHasta: string;
  observacionEnvio: string;
  pagado: boolean;
  formaPagado: EnviosFormaPagado;
  entregado: boolean;
  pdfComprobanteNombre: string | null;
  tienePdf: boolean;
}

/** Orden Conductor: fecha y rango horario más cercanos a ahora (ascendente). */
export function compararEnvioPorProximidad(
  a: Pick<EnviosFinalListItem, "fechaEnvioIso" | "horaDesde" | "horaHasta">,
  b: Pick<EnviosFinalListItem, "fechaEnvioIso" | "horaDesde" | "horaHasta">
): number {
  if (a.fechaEnvioIso !== b.fechaEnvioIso) {
    return a.fechaEnvioIso < b.fechaEnvioIso ? -1 : 1;
  }
  if (a.horaDesde !== b.horaDesde) {
    return a.horaDesde < b.horaDesde ? -1 : 1;
  }
  if (a.horaHasta !== b.horaHasta) {
    return a.horaHasta < b.horaHasta ? -1 : 1;
  }
  return 0;
}

export function nombreDestinatarioEnvio(item: EnviosFinalListItem): string {
  if (item.clienteFinal) return nombreCompletoCliente(item.clienteFinal);
  if (item.pintor) return nombreCompletoCliente(item.pintor);
  return "";
}

export function telefonoEnvio(item: EnviosFinalListItem): string {
  const celCliente = item.clienteFinal?.cel.trim() ?? "";
  if (celCliente !== "") return celCliente;
  return item.pintor?.cel.trim() ?? "";
}

export function etiquetaNombreProyecto(dir: EnviosDireccionItem): string {
  const n = dir.nombreProyecto.trim();
  return n !== "" ? n : etiquetaDireccionEnvio(dir);
}

export function etiquetaDireccionEnvio(dir: EnviosDireccionItem): string {
  const nombre = dir.nombreProyecto.trim();
  const calleNum = [dir.calleNombre.trim(), dir.numeracion.trim()].filter((s) => s !== "").join(" ");
  const distrito = dir.distrito.trim();
  const depto = etiquetaDepartamentoEnvio(dir.departamento);
  let texto = calleNum;
  if (distrito) {
    texto = texto ? `${texto}, ${distrito}` : distrito;
  }
  if (depto) {
    texto = texto ? `${texto}. ${depto}` : depto;
  }
  if (nombre && texto) return `${nombre} — ${texto}`;
  return nombre || texto || "Proyecto";
}

/** Línea de listado wizard: `calle numeracion, distrito - departamento.` */
export function etiquetaDireccionEnvioListado(dir: EnviosDireccionItem): string {
  const calleNum = [dir.calleNombre.trim(), dir.numeracion.trim()].filter((s) => s !== "").join(" ");
  const distrito = dir.distrito.trim();
  const depto = etiquetaDepartamentoEnvio(dir.departamento);
  const calleDistrito = [calleNum, distrito].filter((s) => s !== "").join(", ");
  let texto = calleDistrito;
  if (depto) {
    texto = texto ? `${texto} - ${depto}` : depto;
  }
  if (!texto) return dir.nombreProyecto.trim() || "Proyecto.";
  return texto.endsWith(".") ? texto : `${texto}.`;
}

/** Listado: `- NOMBRE. Dirección (Referencia).` */
export function etiquetaDireccionEnvioFilaListado(dir: EnviosDireccionItem): string {
  const nombre = dir.nombreProyecto.trim();
  const direccion = etiquetaDireccionEnvioListado(dir).replace(/\.+$/, "");
  const referencia = dir.referencia.trim();
  const cuerpoDir = referencia !== "" ? `${direccion} (${referencia}).` : `${direccion}.`;
  if (nombre) {
    const sinFallback =
      direccion === "Proyecto" || direccion === "Proyecto." ? "" : cuerpoDir;
    return sinFallback ? `- ${nombre}. ${sinFallback}` : `- ${nombre}.`;
  }
  return `- ${cuerpoDir}`;
}

export function metaDireccionEnvio(dir: EnviosDireccionItem): string {
  return dir.referencia.trim();
}

export function direccionEnvioTieneDato(data: {
  nombreProyecto?: string | null;
  calleNombre?: string | null;
  numeracion?: string | null;
  distrito?: string | null;
  departamento?: string | null;
  urlMaps?: string | null;
  referencia?: string | null;
}): boolean {
  return (
    (data.nombreProyecto ?? "").trim() !== "" ||
    (data.calleNombre ?? "").trim() !== "" ||
    (data.numeracion ?? "").trim() !== "" ||
    (data.distrito ?? "").trim() !== "" ||
    Boolean(data.departamento) ||
    (data.urlMaps ?? "").trim() !== "" ||
    (data.referencia ?? "").trim() !== ""
  );
}
