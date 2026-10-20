import {
  normalizarReposicionFormaPedido,
  type ReposicionFormaPedidoVendedor,
} from "@/lib/validations/reposicion";

export type ReglaReposicionValores = {
  forma: ReposicionFormaPedidoVendedor;
  punto: number;
  cantConf: number;
};

export type ReglaReposicionEfectiva = {
  regla: ReglaReposicionValores;
  omitida: boolean;
  tienePisoCorp: boolean;
  idReposicionSucursal: string | null;
};

export function valoresReposicionVendedor(
  forma: string | null | undefined,
  punto: number | null | undefined,
  cantConf: number | null | undefined
): ReglaReposicionValores | null {
  const n = normalizarReposicionFormaPedido(forma);
  if (n !== "UNIDADES_MAX" && n !== "POR_BULTO") return null;
  return {
    forma: n,
    punto: Math.max(0, Math.floor(Number(punto ?? 0))),
    cantConf: Math.max(0, Math.floor(Number(cantConf ?? 0))),
  };
}

/** Unidades que implica la regla (`POR_BULTO` = cantConf × bulto). */
export function unidadesDesdeReglaReposicion(
  regla: ReglaReposicionValores,
  bulto: number | null | undefined
): number {
  if (regla.forma !== "POR_BULTO") return Math.max(0, regla.cantConf);
  const unPorBulto = Math.max(0, Math.floor(Number(bulto ?? 0)));
  if (unPorBulto < 1) return 0;
  return regla.cantConf * unPorBulto;
}

export function mensajeViolaPisoReposicionCorp(
  piso: ReglaReposicionValores,
  propuesta: ReglaReposicionValores,
  bulto: number | null | undefined
): string | null {
  if (propuesta.punto < piso.punto) {
    return `El punto de reposición no puede ser menor que el corporativo (${piso.punto}).`;
  }
  const unPiso = unidadesDesdeReglaReposicion(piso, bulto);
  const unProp = unidadesDesdeReglaReposicion(propuesta, bulto);
  if (unProp < unPiso) {
    return `Las unidades a pedir no pueden ser menores que el piso corporativo (${unPiso} un.).`;
  }
  return null;
}

/**
 * Capa corporativa + override de sucursal.
 * Punto efectivo = max. Forma/cant. de sucursal si las unidades no bajan el piso; si no, el corporativo.
 */
export function resolverReglaReposicionEfectiva(params: {
  corp: ReglaReposicionValores | null;
  sucursal: (ReglaReposicionValores & { omitida?: boolean; id?: string | null }) | null;
  bulto: number | null | undefined;
}): ReglaReposicionEfectiva | null {
  const { corp, sucursal, bulto } = params;
  if (!corp && !sucursal) return null;
  if (corp && !sucursal) {
    return {
      regla: corp,
      omitida: false,
      tienePisoCorp: true,
      idReposicionSucursal: null,
    };
  }
  if (!corp && sucursal) {
    return {
      regla: {
        forma: sucursal.forma,
        punto: sucursal.punto,
        cantConf: sucursal.cantConf,
      },
      omitida: sucursal.omitida === true,
      tienePisoCorp: false,
      idReposicionSucursal: sucursal.id ?? null,
    };
  }
  const sucVal: ReglaReposicionValores = {
    forma: sucursal!.forma,
    punto: sucursal!.punto,
    cantConf: sucursal!.cantConf,
  };
  const punto = Math.max(corp!.punto, sucVal.punto);
  const unPiso = unidadesDesdeReglaReposicion(corp!, bulto);
  const unSuc = unidadesDesdeReglaReposicion(sucVal, bulto);
  const regla: ReglaReposicionValores =
    unSuc >= unPiso
      ? { forma: sucVal.forma, punto, cantConf: sucVal.cantConf }
      : { forma: corp!.forma, punto, cantConf: corp!.cantConf };
  return {
    regla,
    omitida: sucursal!.omitida === true,
    tienePisoCorp: true,
    idReposicionSucursal: sucursal!.id ?? null,
  };
}
