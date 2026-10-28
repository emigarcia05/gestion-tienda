import {
  mapCxFinancieroPorFormaPago,
  type CxFinancieroPorFormaPago,
} from "@/lib/finAnaMargenContribucion";
import {
  ensureFinAnaCosFinaSeed,
  listarFinAnaCosFina,
  type FinAnaCosFinaItem,
} from "@/services/finAnaCosFina.service";
import { listarFinAnaCosFinaTerminalesMarcas } from "@/services/finAnaCosFinaTerminalMarca.service";
import { listarFinAnaCosFinaPagos } from "@/services/finAnaCosFinaPago.service";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import type { FinAnaCosFinaTerminalMarcaItem } from "@/lib/finAnaCosFinaTerminalesMarcas";
import {
  listarDescuentosMargenContribucion,
  type DescuentosMargenContribucionMap,
} from "@/services/margenContribucionDesc.service";
import { listarFormulasMargenContribucion } from "@/services/finAnaMcFormulas.service";
import type { FinAnaMcFormulaItem } from "@/lib/finAnaMcFormulas";
import { listarFinAnaMcCategorias } from "@/services/finAnaMcCategorias.service";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import { getFinAnaMcConfig } from "@/services/finAnaMcConfig.service";
import type { FinAnaMcConfigItem } from "@/lib/finAnaMcConfig";

export type { CxFinancieroPorFormaPago };

export type DatosPaginaMargenContribucion = {
  filasCostosFinancieros: FinAnaCosFinaItem[];
  terminales: FinAnaCosFinaTerminalMarcaItem[];
  pagos: FinAnaCosFinaPagoItem[];
  cxFinancieroPorFormaPago: CxFinancieroPorFormaPago;
  descuentosPorColumna: DescuentosMargenContribucionMap;
  formulas: FinAnaMcFormulaItem[];
  categoriasMc: FinAnaMcCategoriaItem[];
  configMc: FinAnaMcConfigItem;
};

export async function getDatosPaginaMargenContribucion(): Promise<DatosPaginaMargenContribucion> {
  await ensureFinAnaCosFinaSeed();
  const [
    filasCostosFinancieros,
    terminales,
    pagos,
    descuentosPorColumna,
    formulas,
    categoriasMc,
    configMc,
  ] = await Promise.all([
    listarFinAnaCosFina(),
    listarFinAnaCosFinaTerminalesMarcas(),
    listarFinAnaCosFinaPagos(),
    listarDescuentosMargenContribucion(),
    listarFormulasMargenContribucion(),
    listarFinAnaMcCategorias(),
    getFinAnaMcConfig(),
  ]);

  return {
    filasCostosFinancieros,
    terminales,
    pagos,
    cxFinancieroPorFormaPago: mapCxFinancieroPorFormaPago(filasCostosFinancieros, pagos),
    descuentosPorColumna,
    formulas,
    categoriasMc,
    configMc,
  };
}
