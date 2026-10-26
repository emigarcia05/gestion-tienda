"use client";

import { usePosicionIvaComparacionAutoRefresh } from "@/lib/hooks/usePosicionIvaComparacionAutoRefresh";

/**
 * En pantallas de pedido que resuelven proveedor por saldo de Balance IVA, consulta periódicamente
 * si cambió el saldo/comparación y ejecuta `router.refresh()` para actualizar la grilla.
 */
export default function PosicionIvaComparacionAutoRefresh({
  initialToken,
}: {
  initialToken: string;
}) {
  usePosicionIvaComparacionAutoRefresh(initialToken);
  return null;
}
