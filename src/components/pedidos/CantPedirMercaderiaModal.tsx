"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import type { IvaProveedor } from "@prisma/client";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ordenarMiembrosPedidoUrgentePorMenorCostoComparable } from "@/lib/precioComparacionPedidoUrgenteReposicion";
import { labelReposicionFormaPedidoVendedor } from "@/lib/validations/reposicion";
import type { PedidoUrgenteItem } from "@/services/listaPrecios.service";

const TITULO_SECCION_CLASS = "text-center text-xs font-bold uppercase tracking-wide text-foreground";

type MiembroUrgente = NonNullable<PedidoUrgenteItem["miembrosAgrupacion"]>[number];

function miembrosUrgente(producto: PedidoUrgenteItem): MiembroUrgente[] {
  if (producto.miembrosAgrupacion && producto.miembrosAgrupacion.length > 0) {
    return producto.miembrosAgrupacion;
  }
  return [
    {
      codExt: producto.id,
      prefijo: producto.prefijo,
      pxCompraFinalSinIva: producto.pxCompraFinalSinIva,
      ivaProveedor: producto.ivaProveedor ?? ("PREGUNTA" satisfies IvaProveedor),
      cantPedidaUrgente: producto.cantPedidaUrgente,
      estaVinculadoTienda: producto.estaVinculadoTienda,
    },
  ];
}

function enteroNoNegativo(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: PedidoUrgenteItem | null;
  /** Cantidades URGENTE vigentes por `cod_ext` (estado optimista de la página). */
  cantPorId: Record<string, string>;
  ivaSaldoAcumuladoComparacion: number;
  /** Guarda solo los `cod_ext` cuya cantidad cambió (0 = borrar). */
  onGuardarUrgente: (cambios: Record<string, number>) => Promise<boolean>;
  /** Abre «Configurar Reposición» (solo productos registrados en tienda). */
  onConfigurarReposicion: (producto: PedidoUrgenteItem) => void;
}

export default function CantPedirMercaderiaModal({
  open,
  onOpenChange,
  producto,
  cantPorId,
  ivaSaldoAcumuladoComparacion,
  onGuardarUrgente,
  onConfigurarReposicion,
}: Props) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const miembros = useMemo(() => {
    if (!producto) return [];
    const base = miembrosUrgente(producto);
    return base.length > 1
      ? ordenarMiembrosPedidoUrgentePorMenorCostoComparable(base, ivaSaldoAcumuladoComparacion)
      : base;
  }, [producto, ivaSaldoAcumuladoComparacion]);

  useEffect(() => {
    if (!open || !producto) return;
    const inicial: Record<string, string> = {};
    for (const m of miembrosUrgente(producto)) {
      const v = cantPorId[m.codExt];
      inicial[m.codExt] = v && Number(v) > 0 ? v : "";
    }
    queueMicrotask(() => setValores(inicial));
    // Solo al abrir: no pisar lo que el usuario está tipeando si cambia `cantPorId`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, producto]);

  if (!producto) return null;

  const cambios: Record<string, number> = {};
  for (const m of miembros) {
    const nuevo = enteroNoNegativo(valores[m.codExt] ?? "");
    const previo = enteroNoNegativo(cantPorId[m.codExt] ?? "");
    if (nuevo !== previo) cambios[m.codExt] = nuevo;
  }
  const hayCambios = Object.keys(cambios).length > 0;
  const regla = producto.reposicionRegla;

  async function handleGuardar() {
    if (!hayCambios) {
      onOpenChange(false);
      return;
    }
    setGuardando(true);
    try {
      const ok = await onGuardarUrgente(cambios);
      if (ok) onOpenChange(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="Cant. a Pedir"
        size="md"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button type="button" onClick={handleGuardar} disabled={guardando || !hayCambios}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        }
      >
        <div className="flex w-full flex-col gap-4 text-center">
          <p className="text-sm font-medium text-foreground">{producto.descripcion}</p>

          <section className="modal-seccion-formulario flex flex-col gap-3">
            <h3 className={TITULO_SECCION_CLASS}>Urgente</h3>
            <div className="grid grid-cols-[1fr_8rem] items-center gap-x-4 gap-y-2">
              <ModalMicroLabel className="text-left">PROVEEDOR</ModalMicroLabel>
              <ModalMicroLabel>CANT. A PEDIR</ModalMicroLabel>
              {miembros.map((m, idx) => (
                <div key={m.codExt} className="contents">
                  <span className="truncate text-left text-sm text-foreground">
                    {m.prefijo?.trim() || `Proveedor ${idx + 1}`}
                    {miembros.length > 1 && idx === 0 ? (
                      <span className="ml-2 text-xs text-muted-foreground">(prioridad por costo)</span>
                    ) : null}
                  </span>
                  <Input
                    inputMode="numeric"
                    value={valores[m.codExt] ?? ""}
                    placeholder="0"
                    autoFocus={idx === 0}
                    onChange={(e) =>
                      setValores((prev) => ({ ...prev, [m.codExt]: e.target.value.replace(/\D/g, "") }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleGuardar();
                      }
                    }}
                    className="text-center tabular-nums"
                    aria-label={`Cantidad urgente ${m.prefijo}`}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="modal-seccion-formulario flex flex-col gap-3">
            <h3 className={TITULO_SECCION_CLASS}>Reposición</h3>
            {producto.estaVinculadoTienda ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <ModalMicroLabel>FORMA PEDIR</ModalMicroLabel>
                    <span className="text-sm tabular-nums text-foreground">
                      {regla ? labelReposicionFormaPedidoVendedor(regla.formaPedir) || "—" : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <ModalMicroLabel>PTO. REPOSICIÓN</ModalMicroLabel>
                    <span className="text-sm tabular-nums text-foreground">
                      {regla ? regla.puntoReposicion : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <ModalMicroLabel>CANT. A PEDIR</ModalMicroLabel>
                    <span className="text-sm tabular-nums text-foreground">
                      {regla ? producto.cantReposicion : "—"}
                    </span>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onConfigurarReposicion(producto)}
                  >
                    <Settings2 className="h-4 w-4" aria-hidden />
                    {regla ? "Editar Reposición" : "Configurar Reposición"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Disponible solo para productos registrados en Tienda.
              </p>
            )}
          </section>
        </div>
      </AppModal>
    </Dialog>
  );
}
