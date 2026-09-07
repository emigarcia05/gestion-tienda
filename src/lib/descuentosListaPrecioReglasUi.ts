import type { CampoReglaDescuentoListaPrecioInput } from "@/lib/validations/descuentosListaPrecioReglas";
import {
  CAMPO_DESC_ESPECIAL,
  CAMPO_PX_PROMO_FIJO,
  type DescuentosMaterializadosItem,
} from "@/lib/descuentosListaPrecioReglasConstants";

export const CAMPOS_REGLA_DESCUENTO_OPCIONES: {
  value: CampoReglaDescuentoListaPrecioInput;
  label: string;
  etiquetaCorta: string;
  tipo: "descuento" | "costo";
  propiedadFila: keyof DescuentosMaterializadosItem;
}[] = [
  {
    value: "dto_proveedor",
    label: "DESC. PROV.",
    etiquetaCorta: "Prov.",
    tipo: "descuento",
    propiedadFila: "dtoProveedor",
  },
  {
    value: "dto_marca",
    label: "DESC. MARCA",
    etiquetaCorta: "Marca",
    tipo: "descuento",
    propiedadFila: "dtoMarca",
  },
  {
    value: "dto_rubro",
    label: "DESC. RUBRO",
    etiquetaCorta: "Rubro",
    tipo: "descuento",
    propiedadFila: "dtoRubro",
  },
  {
    value: "dto_cantidad",
    label: "DESC. CANT.",
    etiquetaCorta: "Cant.",
    tipo: "descuento",
    propiedadFila: "dtoCantidad",
  },
  {
    value: "dto_financiero",
    label: "DESC. FINAN.",
    etiquetaCorta: "Finan.",
    tipo: "descuento",
    propiedadFila: "dtoFinanciero",
  },
  {
    value: "cx_transporte",
    label: "CX. TRANSP.",
    etiquetaCorta: "Transp.",
    tipo: "costo",
    propiedadFila: "cxTransporte",
  },
];

export function labelCampoReglaDescuento(
  campo:
    | CampoReglaDescuentoListaPrecioInput
    | typeof CAMPO_DESC_ESPECIAL
    | typeof CAMPO_PX_PROMO_FIJO
): string {
  if (campo === CAMPO_DESC_ESPECIAL) return "DESC. ESPECÍFICO";
  if (campo === CAMPO_PX_PROMO_FIJO) return "PX PROMO FIJO";
  return CAMPOS_REGLA_DESCUENTO_OPCIONES.find((o) => o.value === campo)?.label ?? campo;
}

export function tipoCampoReglaDescuento(
  campo: CampoReglaDescuentoListaPrecioInput
): "descuento" | "costo" {
  return CAMPOS_REGLA_DESCUENTO_OPCIONES.find((o) => o.value === campo)?.tipo ?? "descuento";
}

/** Orden alfabético: proveedor → marca → rubro (comodín = cadena vacía). */
export function ordenarReglasDescuentoListaPrecio<
  T extends {
    idProveedor?: string | null;
    idMarca?: string | null;
    idRubro?: string | null;
    proveedorPrefijo?: string | null;
    marcaNombre?: string | null;
    rubroNombre?: string | null;
  },
>(reglas: T[]): T[] {
  const localeOpts: Intl.CollatorOptions = { sensitivity: "base" };
  return [...reglas].sort((a, b) => {
    const cmpProv = celdaCondicionReglaDescuento(a, "proveedor").localeCompare(
      celdaCondicionReglaDescuento(b, "proveedor"),
      "es",
      localeOpts
    );
    if (cmpProv !== 0) return cmpProv;
    const cmpMarca = celdaCondicionReglaDescuento(a, "marca").localeCompare(
      celdaCondicionReglaDescuento(b, "marca"),
      "es",
      localeOpts
    );
    if (cmpMarca !== 0) return cmpMarca;
    return celdaCondicionReglaDescuento(a, "rubro").localeCompare(
      celdaCondicionReglaDescuento(b, "rubro"),
      "es",
      localeOpts
    );
  });
}

export function fmtCondicionesReglaDescuento(regla: {
  idProveedor?: string | null;
  idMarca?: string | null;
  idRubro?: string | null;
  proveedorNombre?: string | null;
  marcaNombre?: string | null;
  rubroNombre?: string | null;
}): string {
  const partes: string[] = [];
  if (regla.idProveedor) {
    partes.push(regla.proveedorNombre ?? "PROVEEDOR");
  }
  if (regla.idMarca) {
    partes.push(regla.marcaNombre ?? "MARCA");
  }
  if (regla.idRubro) {
    partes.push(regla.rubroNombre ?? "RUBRO");
  }
  return partes.length > 0 ? partes.join(" + ") : "TODOS";
}

/** Valor de celda PROVEEDOR / MARCA / RUBRO en grilla de reglas (vacío = comodín o sin dato). */
export function celdaCondicionReglaDescuento(
  regla: {
    idProveedor?: string | null;
    idMarca?: string | null;
    idRubro?: string | null;
    proveedorNombre?: string | null;
    proveedorPrefijo?: string | null;
    marcaNombre?: string | null;
    rubroNombre?: string | null;
  },
  dimension: "proveedor" | "marca" | "rubro"
): string {
  switch (dimension) {
    case "proveedor":
      return regla.idProveedor ? regla.proveedorPrefijo?.trim() ?? "" : "";
    case "marca":
      return regla.idMarca ? regla.marcaNombre?.trim() ?? "" : "";
    case "rubro":
      return regla.idRubro ? regla.rubroNombre?.trim() ?? "" : "";
  }
}

type LineaCondicionReglaDescuento = {
  dimension: "Proveedor" | "Marca" | "Rubro";
  valor: string;
};

/** Líneas para el detalle de regla (modal ítem): Proveedor / Marca / Rubro activos en orden fijo. */
export function lineasCondicionReglaDescuento(regla: {
  idProveedor?: string | null;
  idMarca?: string | null;
  idRubro?: string | null;
  proveedorNombre?: string | null;
  marcaNombre?: string | null;
  rubroNombre?: string | null;
}): LineaCondicionReglaDescuento[] {
  const lineas: LineaCondicionReglaDescuento[] = [];
  if (regla.idProveedor) {
    lineas.push({
      dimension: "Proveedor",
      valor: regla.proveedorNombre?.trim() || "—",
    });
  }
  if (regla.idMarca) {
    lineas.push({
      dimension: "Marca",
      valor: regla.marcaNombre?.trim() || "—",
    });
  }
  if (regla.idRubro) {
    lineas.push({
      dimension: "Rubro",
      valor: regla.rubroNombre?.trim() || "—",
    });
  }
  return lineas;
}

/** Ancho % columna ACCIONES compartida entre pestañas GENERAL y POR PRODUCTO (modal Reglas Descuentos). */
const REGLAS_DESCUENTOS_ACCIONES_COL_PCT = 18;

export const REGLAS_DESCUENTOS_ACCIONES_HEAD_DIVIDER_CLASS =
  "tabla-bloque-secundario-head-divider";

export const REGLAS_DESCUENTOS_ACCIONES_CELL_DIVIDER_CLASS =
  "tabla-bloque-secundario-cell-divider";

/** Anchos % pestaña GENERAL (suma 100); última columna = ACCIONES. */
export const REGLAS_DESCUENTOS_GENERAL_COL_WIDTHS_PCT = [
  10,
  22,
  22,
  18,
  10,
  REGLAS_DESCUENTOS_ACCIONES_COL_PCT,
] as const;

/** Anchos % pestaña POR PRODUCTO (suma 100); última columna = ACCIONES. */
export const REGLAS_DESC_ESPEC_COL_WIDTHS_PCT = [
  25,
  9,
  12,
  12,
  12,
  12,
  REGLAS_DESCUENTOS_ACCIONES_COL_PCT,
] as const;
