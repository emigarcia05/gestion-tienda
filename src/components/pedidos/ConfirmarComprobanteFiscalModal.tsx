"use client";

import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  /**
   * El cierre por overlay/ESC equivale a cancelar (no decisión). El padre
   * debe limpiar cualquier promesa en curso al recibir `false`.
   */
  onOpenChange: (open: boolean) => void;
  /**
   * Selección del operador:
   * - `true`  → "SI" → comprobante fiscal → **FACTURA** en DUX.
   * - `false` → "NO" → sin fiscal → **Comprobante_Compra** en DUX.
   * El componente NO cierra el modal por sí mismo; deja que el padre lo haga
   * (así puede invocar la Action y solo cerrar si todo terminó OK).
   */
  onSeleccionar: (decision: boolean) => void;
  /**
   * Si el padre está procesando el resultado (Action en curso), inhabilita
   * los botones para evitar doble disparo.
   */
  pending?: boolean;
}

/**
 * Modal "¿La compra genera comprobante fiscal?". Se abre solo cuando
 * `proveedor.iva === PREGUNTA` antes de registrar la compra en DUX.
 *
 * Para `proveedor.iva === SIEMPRE` o `NUNCA` el modal no aparece y el
 * mapeo `iva → tipoComprobante` (**FACTURA** | Comprobante_Compra en Excel) se aplica
 * automáticamente en el servicio (`resolverTipoComprobantePorIva`).
 */
export default function ConfirmarComprobanteFiscalModal({
  open,
  onOpenChange,
  onSeleccionar,
  pending = false,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="Confirmar Comprobante Fiscal"
        size="sm"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onSeleccionar(false)}
            >
              No
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => onSeleccionar(true)}
            >
              Si
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          ¿La compra genera comprobante fiscal?
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          La respuesta determina el tipo de comprobante en DUX:
          <br />
          <span className="font-medium">SI</span> → FACTURA ·{" "}
          <span className="font-medium">NO</span> → Comprobante_Compra
        </p>
      </AppModal>
    </Dialog>
  );
}
