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
  { value: "EFECTIVO", label: "EFECTIVO" },
  { value: "CHEQUE", label: "CHEQUE" },
];

export function tipoValorDesdeTipoCaja(tipo: TipoCajaTesoreria): TipoValorTesoreria {
  if (tipo === "BANCO" || tipo === "BILLETERA_DIGITAL" || tipo === "TARJETAS_A_COBRAR") return "DIGITAL";
  if (tipo === "EFECTIVO") return "EFECTIVO";
  return "CHEQUE";
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
