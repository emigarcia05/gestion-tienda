import { revalidatePath } from "next/cache";
import { REVALIDATE_PEDIDOS_MERCADERIA } from "@/lib/gestionProductosRoutes";

/**
 * Invalida pantallas de pedido que resuelven proveedor por menor costo comparable (Posición IVA).
 *
 * Llamar tras cualquier cambio que impacte débito/crédito/saldo manual de IVA.
 * También se invoca desde persistencia (sync compras DUX) para cubrir rutas API
 * o llamadas que no pasen por Server Actions.
 */
export function revalidatePedidoUrgenteTrasCambioIvaSaldo(): void {
  for (const path of REVALIDATE_PEDIDOS_MERCADERIA) {
    revalidatePath(path);
  }
}
