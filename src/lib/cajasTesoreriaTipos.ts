import type {
  TipoCajaTesoreria,
  TipoValorTesoreria,
} from "@prisma/client";

/** Opciones de alta/edición en UI (valor = enum Prisma). */
export const OPCIONES_TIPO_CAJA_TESORERIA_UI: { value: TipoCajaTesoreria; label: string }[] = [
  { value: "BANCO", label: "BANCO" },
  { value: "BILLETERA_DIGITAL", label: "BILLETERA DIGITAL" },
  { value: "CHEQUE", label: "CHEQUE" },
  { value: "EFECTIVO", label: "CAJA LOCAL" },
  { value: "TARJETAS_A_COBRAR", label: "TERMINAL DE PAGO" },
];

export const OPCIONES_TIPO_VALOR_TESORERIA_UI: { value: TipoValorTesoreria; label: string }[] = [
  { value: "DIGITAL", label: "DIGITAL" },
  { value: "EFECTIVO", label: "DIGITAL" },
  { value: "CHEQUE", label: "CHEQUE" },
];

/** Alta/edición de caja: no se elige CHEQUE (queda implícito si `tipoCaja = CHEQUE`). */
export const OPCIONES_TIPO_VALOR_CAJA_MODAL_UI: {
  value: Exclude<TipoValorTesoreria, "CHEQUE">;
  label: string;
}[] = [
  { value: "EFECTIVO", label: "DIGITAL" },
  { value: "DIGITAL", label: "DIGITAL" },
];

export function tipoValorDesdeTipoCaja(tipo: TipoCajaTesoreria): TipoValorTesoreria {
  if (tipo === "BANCO" || tipo === "BILLETERA_DIGITAL" || tipo === "TARJETAS_A_COBRAR") return "DIGITAL";
  if (tipo === "EFECTIVO") return "EFECTIVO";
  return "CHEQUE";
}

/** CHEQUE de caja exige `tipo_valor = CHEQUE`; el resto elige EFECTIVO o DIGITAL (ambos se muestran DIGITAL). */
export function tipoValorCompatibleConTipoCaja(
  tipoCaja: TipoCajaTesoreria,
  tipoValor: TipoValorTesoreria
): boolean {
  if (tipoCaja === "CHEQUE") return tipoValor === "CHEQUE";
  return tipoValor === "DIGITAL" || tipoValor === "EFECTIVO";
}

export function siguienteTipoValorAlCambiarTipoCaja(
  nextTipoCaja: TipoCajaTesoreria,
  tipoValorActual: TipoValorTesoreria
): TipoValorTesoreria {
  if (nextTipoCaja === "CHEQUE") return "CHEQUE";
  if (tipoValorCompatibleConTipoCaja(nextTipoCaja, tipoValorActual)) return tipoValorActual;
  return tipoValorDesdeTipoCaja(nextTipoCaja);
}

/** Las cajas CHEQUE no tienen sucursal. */
export function cajaTesoreriaUsaSucursal(tipo: TipoCajaTesoreria): boolean {
  return tipo !== "CHEQUE";
}

/** Etiqueta de pantalla para filtros, tabla y selects (enum persistido sin cambiar). */
export function etiquetaTipoCajaEnPantalla(tipo: TipoCajaTesoreria): string {
  return (
    OPCIONES_TIPO_CAJA_TESORERIA_UI.find((o) => o.value === tipo)?.label ??
    tipo.replaceAll("_", " ")
  );
}

/** «TIPO - ENTIDAD - SUCURSAL - TITULAR» (omite partes vacías). */
export function etiquetaCajaTesoreria(caja: {
  titular: string;
  tipoCaja: TipoCajaTesoreria;
  entidad: { nombre: string } | null;
  sucursal: { nombre: string } | null;
}): string {
  const partes = [
    etiquetaTipoCajaEnPantalla(caja.tipoCaja),
    caja.entidad?.nombre.trim()
      ? caja.entidad.nombre.toLocaleUpperCase("es-AR")
      : null,
    caja.sucursal?.nombre.trim()
      ? caja.sucursal.nombre.toLocaleUpperCase("es-AR")
      : null,
    caja.titular.trim()
      ? caja.titular.toLocaleUpperCase("es-AR")
      : null,
  ].filter((parte): parte is string => parte != null && parte.length > 0);
  return partes.join(" - ");
}
