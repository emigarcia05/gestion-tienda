import { revalidatePath } from "next/cache";
import { REVALIDATE_PEDIDOS_MERCADERIA } from "@/lib/gestionProductosRoutes";

/**
 * Invalida pantallas de pedido que resuelven proveedor por menor costo comparable (saldo Balance IVA).
 *
 * Llamar tras cualquier cambio que impacte débito/crédito de IVA.
 */
export function revalidatePedidoUrgenteTrasCambioIvaSaldo(): void {
  for (const path of REVALIDATE_PEDIDOS_MERCADERIA) {
    revalidatePath(path);
  }
}
