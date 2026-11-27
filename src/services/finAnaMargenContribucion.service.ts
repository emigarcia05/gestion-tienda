import {
  mapCxFinancieroPorFormaPago,
  type CxFinancieroPorFormaPago,
} from "@/lib/finAnaMargenContribucion";
import {
  ensureFinAnaCosFinaSeed,
  listarFinAnaCosFina,
  type FinAnaCosFinaItem,
} from "@/services/finAnaCosFina.service";
import { listarFinAnaCosFinaPagos } from "@/services/finAnaCosFinaPago.service";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import {
  listarDescuentosMargenContribucion,
  type DescuentosMargenContribucionMap,
} from "@/services/margenContribucionDesc.service";
import { listarFormulasMargenContribucion } from "@/services/finAnaMcFormulas.service";
import type { FinAnaMcFormulaItem } from "@/lib/finAnaMcFormulas";
import { listarFinAnaMcCategorias } from "@/services/finAnaMcCategorias.service";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";

export type { CxFinancieroPorFormaPago };

export type DatosPaginaMargenContribucion = {
  filasCostosFinancieros: FinAnaCosFinaItem[];
  pagos: FinAnaCosFinaPagoItem[];
  cxFinancieroPorFormaPago: CxFinancieroPorFormaPago;
  descuentosPorColumna: DescuentosMargenContribucionMap;
  formulas: FinAnaMcFormulaItem[];
  categoriasMc: FinAnaMcCategoriaItem[];
};

export async function getDatosPaginaMargenContribucion(): Promise<DatosPaginaMargenContribucion> {
  await ensureFinAnaCosFinaSeed();
  const [
    filasCostosFinancieros,
    pagos,
    descuentosPorColumna,
    formulas,
    categoriasMc,
  ] = await Promise.all([
    listarFinAnaCosFina(),
    listarFinAnaCosFinaPagos(),
    listarDescuentosMargenContribucion(),
    listarFormulasMargenContribucion(),
    listarFinAnaMcCategorias(),
  ]);

  return {
    filasCostosFinancieros,
    pagos,
    cxFinancieroPorFormaPago: mapCxFinancieroPorFormaPago(filasCostosFinancieros, pagos),
    descuentosPorColumna,
    formulas,
    categoriasMc,
  };
}
