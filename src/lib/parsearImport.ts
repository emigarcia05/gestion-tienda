/**
 * Convierte strings de precio con formato variado a número.
 * Soporta: "$6.399", "6.399,50", "6399.50", "6,399.50"
 */
export function parsePrecio(raw: string): number {
  let s = raw.replace(/[$\s]/g, "");
  const tieneComa = s.includes(",");
  const tienePunto = s.includes(".");

  if (tieneComa && tienePunto) {
    const ultimaComa = s.lastIndexOf(",");
    const ultimoPunto = s.lastIndexOf(".");
    if (ultimaComa > ultimoPunto) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (tieneComa) {
    s = s.replace(",", ".");
  } else if (tienePunto) {
    const partes = s.split(".");
    if (partes.length === 2 && partes[1].length === 3) {
      s = s.replace(".", "");
    }
  }

  return parseFloat(s);
}

export interface FilaProducto {
  codProdProv: string;
  descripcion: string;
  precioLista: number;
  precioVentaSugerido: number;
}

export type CampoDestino = "codProdProv" | "descripcion" | "precioLista" | "precioVentaSugerido" | "ignorar";

export interface MapeoColumnas {
  [indiceColumna: number]: CampoDestino;
}

// ─── Lista de precios proveedores (proveedor_prod_lista) ───────────────

export type CampoDestinoListaPrecios =
  | "codigoExterno"
  | "codProdProv"
  | "descripcion"
  | "marca"
  | "precioLista"
  | "precioVentaSugerido"
  | "ignorar";

export interface MapeoColumnasListaPrecios {
  [indiceColumna: number]: CampoDestinoListaPrecios;
}

export interface FilaListaPrecio {
  codigoExterno: string;
  codProdProv: string;
  descripcion: string;
  precioLista: number;
  precioVentaSugerido: number;
  /** Solo si el CSV mapeó columna MARCA; `null` = celda vacía. */
  marca?: string | null;
}

/**
 * Aplica el mapeo de columnas a filas crudas y devuelve FilaListaPrecio[].
 * Valores por defecto: precioVentaSugerido 0 si vacío.
 */
export function aplicarMapeoListaPrecios(
  filas: string[][],
  mapeo: MapeoColumnasListaPrecios
): FilaListaPrecio[] {
  const get = (cols: string[], campo: CampoDestinoListaPrecios): string => {
    const idx = Object.entries(mapeo).find(([, v]) => v === campo)?.[0];
    if (idx === undefined) return "";
    return cols[Number(idx)] ?? "";
  };

  const tieneMapeoMarca = Object.values(mapeo).includes("marca");

  return filas
    .map((cols) => {
      const codProdProv = get(cols, "codProdProv").trim();
      if (!codProdProv) return null;

      const codigoExterno = get(cols, "codigoExterno").trim();
      const descripcion = get(cols, "descripcion").trim();
      const precioListaRaw = get(cols, "precioLista");
      const precioVentaRaw = get(cols, "precioVentaSugerido");

      const precioLista = parsePrecio(precioListaRaw);
      const precioVentaSugerido = parsePrecio(precioVentaRaw);
      const precioListaFinal =
        !precioListaRaw || precioListaRaw.trim() === "" || isNaN(precioLista) ? 0 : precioLista;
      const precioVentaFinal =
        !precioVentaRaw || precioVentaRaw.trim() === "" || isNaN(precioVentaSugerido)
          ? 0
          : precioVentaSugerido;

      const fila: FilaListaPrecio = {
        codigoExterno: codigoExterno || codProdProv,
        codProdProv,
        descripcion,
        precioLista: precioListaFinal,
        precioVentaSugerido: precioVentaFinal,
      };

      if (tieneMapeoMarca) {
        fila.marca = get(cols, "marca").trim() || null;
      }

      return fila;
    })
    .filter((f): f is FilaListaPrecio => f !== null);
}

/**
 * Parsea un CSV y devuelve las filas crudas (arrays de strings).
 * Si tieneEncabezados=true, la primera fila se devuelve como encabezados
 * y las demás como datos. Si es false, no hay encabezados.
 */
export function parsearCSVCrudo(raw: string, tieneEncabezados: boolean): {
  encabezados: string[] | null;
  filas: string[][];
} {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) throw new Error("El archivo está vacío.");

  const sep = detectarSeparador(lines[0]);
  const todas = lines.map((l) => dividirLinea(l, sep));

  if (tieneEncabezados) {
    if (todas.length < 2) throw new Error("El archivo solo tiene encabezados, sin datos.");
    return { encabezados: todas[0], filas: todas.slice(1) };
  }

  return { encabezados: null, filas: todas };
}

function detectarSeparador(linea: string): string {
  const conteos: Record<string, number> = {
    ",": (linea.match(/,/g) ?? []).length,
    ";": (linea.match(/;/g) ?? []).length,
    "|": (linea.match(/\|/g) ?? []).length,
    "\t": (linea.match(/\t/g) ?? []).length,
  };
  return Object.entries(conteos).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Divide una línea CSV respetando campos entre comillas.
 * Si el campo no está entre comillas, lo divide por el separador.
 */
function dividirLinea(linea: string, sep: string): string[] {
  const cols: string[] = [];
  let actual = "";
  let dentroComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"' || ch === "'") {
      dentroComillas = !dentroComillas;
    } else if (ch === sep && !dentroComillas) {
      cols.push(actual.trim());
      actual = "";
    } else {
      actual += ch;
    }
  }
  cols.push(actual.trim());
  return cols;
}

