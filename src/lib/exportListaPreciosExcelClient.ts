import { formatDdMmHhMmResumenAumentosArgentina } from "@/lib/fechaArgentina";
import type { FilaListaPrecioParaCliente } from "@/services/listaPrecios.service";

function round2(n: number | null | undefined): number | "" {
  if (n == null || Number.isNaN(n)) return "";
  return Math.round(n * 100) / 100;
}

/** Excel `.xls` con todos los ítems filtrados de lista de precios proveedor. */
export function descargarExcelListaPrecios(filas: FilaListaPrecioParaCliente[]): void {
  void import("xlsx").then((XLSX) => {
    const hojaFilas = filas.map((f) => ({
      "COD. EXT.": f.codExt,
      "COD. PROD. PROV.": f.codProdProveedor,
      PROVEEDOR: f.proveedor?.nombre ?? "",
      "PREF. PROV.": f.proveedor?.prefijo ?? "",
      "DESCRIPCION TIENDA": f.descripcionTienda ?? "",
      "DESCRIPCION PROVEEDOR": f.descripcionProveedor,
      MARCA: f.marca ?? "",
      RUBRO: f.rubro ?? "",
      HABILITADO: f.habilitado ? "SI" : "NO",
      "PX. LISTA PROV.": round2(f.pxListaProveedor),
      "PX. PROMO FIJO USD": round2(f.pxPromoFijo),
      "PX. FINAL SIN IVA": round2(f.pxCompraFinalSinIva),
      "DESC. PROV.": round2(f.dtoProveedor),
      "DESC. MARCA": round2(f.dtoMarca),
      "DESC. RUBRO": round2(f.dtoRubro),
      "DESC. CANT.": round2(f.dtoCantidad),
      "DESC. FINAN.": round2(f.dtoFinanciero),
      "CX. TRANSPORTE": round2(f.cxTransporte),
    }));
    const hoja = XLSX.utils.json_to_sheet(hojaFilas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Lista Precios");
    hoja["!cols"] = [
      { wch: 14 },
      { wch: 16 },
      { wch: 28 },
      { wch: 10 },
      { wch: 36 },
      { wch: 36 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
    ];
    const nombre = `Lista Precios ${formatDdMmHhMmResumenAumentosArgentina(new Date())}.xls`;
    XLSX.writeFile(libro, nombre, { bookType: "xls" });
  });
}
