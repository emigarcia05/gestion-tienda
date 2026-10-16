/**
 * Pruebas manuales del aplanado de matriz PDF → filas tabulares.
 * Ejecutar: npx tsx scripts/test-aplanar-pdf-matriz.ts
 */
import {
  aplanarMatrizListaPrecios,
  buildDescripcionExport,
  celdaPrecioEsVacia,
  clavesMatchItemPdf,
  esPresentacionUnidad,
  normalizarDescripcionMatchPdf,
} from "../src/lib/listaPreciosPdfMatriz";
import { parseMatrizTabularListaPrecios } from "../src/services/parseListaPreciosPdfMatriz.service";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Reglas de descripción export
assert(esPresentacionUnidad("Un."), "Un. es unidad");
assert(buildDescripcionExport("Maquina amoladora", "Un.") === "Maquina amoladora", "Unidad sin sufijo");
assert(
  buildDescripcionExport("Latex Blanco", "10 L") === "Latex Blanco 10 L",
  "Presentación con sufijo"
);

// Matriz tabular de ejemplo (encabezado + 2 productos)
const filasTabulares = [
  ["Descripción", "Un.", "¼", "½", "1 L", "4 L", "10 L", "20 L"],
  ["Maquina amoladora", "$10", "", "", "", "", "", ""],
  ["Latex Blanco", "", "", "", "", "", "$10", "$20"],
];

const result = parseMatrizTabularListaPrecios(filasTabulares, {
  paginaInicioUsada: 9,
  filasIgnorar: 0,
});
assert(result.filas.length === 3, `Esperadas 3 filas, got ${result.filas.length}`);

const maq = result.filas.find((f) => f.descripcionBase === "Maquina amoladora");
assert(!!maq && maq.presentacion === "Un." && maq.precio === 10, "Maquina amoladora Un. $10");

const lb10 = result.filas.find((f) => f.descripcionExport === "Latex Blanco 10 L");
const lb20 = result.filas.find((f) => f.descripcionExport === "Latex Blanco 20 L");
assert(!!lb10 && lb10.precio === 10, "Latex 10 L");
assert(!!lb20 && lb20.precio === 20, "Latex 20 L");

// Aplanado directo
const { filas } = aplanarMatrizListaPrecios({
  presentaciones: ["Un.", "10 L", "20 L"],
  filas: [
    { descripcionBase: "X", celdas: { "Un.": "100", "10 L": "", "20 L": "200" } },
  ],
});
assert(filas.length === 2, "Ignora vacíos");

assert(celdaPrecioEsVacia("▲"), "▲ cuenta como celda vacía");
const { filas: sinTriangulo } = aplanarMatrizListaPrecios({
  presentaciones: ["Un.", "10 L"],
  filas: [{ descripcionBase: "Producto ▲ test", celdas: { "Un.": "▲", "10 L": "$5" } }],
});
assert(sinTriangulo.length === 1 && sinTriangulo[0]!.descripcionExport === "Producto test 10 L", "Ignora ▲");

// Emparejamiento PDF (descripción + presentación) ↔ descripción de la lista del proveedor
const clave = (d: string, p: string) => clavesMatchItemPdf(d, p);
const norm = normalizarDescripcionMatchPdf;
assert(clave("FIJADOR CONC AL AGUA ALBA", "4 L").includes(norm("FIJADOR CONC AL AGUA ALBA 4")), "4 L ↔ 4");
assert(clave("FONDO BLANCO COLORIN", "½").includes(norm("FONDO BLANCO COLORIN 0,5")), "½ ↔ 0,5");
assert(clave("FONDO BLANCO COLORIN", "¼").includes(norm("FONDO BLANCO COLORIN 1/4")), "¼ ↔ 1/4");
assert(clave("Maquina amoladora", "Un.")[0] === norm("MAQUINA AMOLADORA"), "Un. = solo descripción");
assert(norm("LATEX 20 LTS") === "LATEX 20", "Quita LTS");
assert(norm("4 LATEX") === "4 LATEX", "No quita la L de una palabra");

console.log("OK — test-aplanar-pdf-matriz");
