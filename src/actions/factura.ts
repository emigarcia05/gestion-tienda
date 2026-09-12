"use server";

import { requireFacturacionLectura } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import { buscarProductosFacturaSchema } from "@/lib/validations/factura";
import {
  buscarProductosParaFactura,
  type ProductoFacturaBusquedaItem,
} from "@/services/facturaProductos.service";

export async function buscarProductosFacturaAction(
  raw: unknown
): Promise<ActionResult<{ items: ProductoFacturaBusquedaItem[] }>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;

  const parsed = buscarProductosFacturaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const res = await buscarProductosParaFactura({
    q: parsed.data.q,
    take: parsed.data.take,
  });
  return fromServiceResult(res);
}
