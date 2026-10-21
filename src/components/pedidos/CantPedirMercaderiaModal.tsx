"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { IvaProveedor } from "@prisma/client";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import EnteroStepperInput from "@/components/shared/EnteroStepperInput";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ReposicionConfigCampos, { useReposicionConfigForm } from "@/components/pedidos/ReposicionConfigForm";
import type { ItemReposicion, SucursalReposicion } from "@/actions/reposicion";
import { ordenarMiembrosPedidoUrgentePorMenorCostoComparable } from "@/lib/precioComparacionPedidoUrgenteReposicion";
import { valoresReposicionVendedor } from "@/lib/reposicionCorp";
import { normalizarReposicionFormaPedido } from "@/lib/validations/reposicion";
import type { PedidoUrgenteItem } from "@/services/listaPrecios.service";

const TITULO_SECCION_CLASS = "text-center text-xs font-bold uppercase tracking-wide text-foreground";
/** Ancho fijo de la columna CANT. A PEDIR (input + − / + apilados). */
const ANCHO_CANT_URGENTE_CLASS = "w-44";

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

/** Placeholder mientras no hay producto (el hook de reposición se llama siempre). */
const ITEM_REPOSICION_VACIO: ItemReposicion = {
  idListaTienda: "",
  codExt: "",
  codTienda: "",
  descripcionTienda: null,
  stock: 0,
  idProveedor: null,
  nombreProveedor: null,
  idReposicion: null,
  formaPedir: "",
  puntoReposicion: 0,
  cant: 0,
  cantPedidaReposicion: 0,
  cantPedir: 0,
  bulto: null,
  tienePisoCorp: false,
  pisoCorp: null,
};

function itemReposicionDesdeProducto(prod: PedidoUrgenteItem): ItemReposicion {
  const regla = prod.reposicionRegla;
  return {
    idListaTienda: prod.codTienda,
    codExt: prod.codExt,
    codTienda: prod.codTienda,
    descripcionTienda: prod.descripcion,
    stock: prod.stockTienda,
    idProveedor: null,
    nombreProveedor: null,
    idReposicion: regla?.idReposicion ?? null,
    formaPedir: normalizarReposicionFormaPedido(regla?.formaPedir) ?? "",
    puntoReposicion: regla?.puntoReposicion ?? 0,
    cant: regla?.cantConf ?? 0,
    cantPedidaReposicion: prod.cantReposicion,
    cantPedir: prod.cantReposicion,
    bulto: prod.bultoTienda,
    tienePisoCorp: regla?.tienePisoCorp ?? false,
    pisoCorp: regla?.pisoCorp
      ? valoresReposicionVendedor(regla.pisoCorp.forma, regla.pisoCorp.punto, regla.pisoCorp.cantConf)
      : null,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: PedidoUrgenteItem | null;
  /** Sucursal del usuario de pestaña ("" = sin usuario: reposición no editable). */
  sucursal: SucursalReposicion | "";
  /** Cantidades URGENTE vigentes por `cod_ext` (estado optimista de la página). */
  cantPorId: Record<string, string>;
  ivaSaldoAcumuladoComparacion: number;
  /** Guarda solo los `cod_ext` cuya cantidad cambió (0 = borrar); `null` = sin toast de éxito. */
  onGuardarUrgente: (cambios: Record<string, number>, mensajeExito?: string | null) => Promise<boolean>;
  /** Quita «No pedir en este pedido» de la regla. */
  onReactivarReposicion: (producto: PedidoUrgenteItem) => void;
}

export default function CantPedirMercaderiaModal({
  open,
  onOpenChange,
  producto,
  sucursal,
  cantPorId,
  ivaSaldoAcumuladoComparacion,
  onGuardarUrgente,
  onReactivarReposicion,
}: Props) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const itemRepo = useMemo(
    () => (producto?.codTienda ? itemReposicionDesdeProducto(producto) : ITEM_REPOSICION_VACIO),
    [producto]
  );
  const repoEditable = Boolean(producto?.estaVinculadoTienda && producto.codTienda && sucursal);
  const formRepo = useReposicionConfigForm({
    open: open && repoEditable,
    item: itemRepo,
    sucursal: sucursal || undefined,
  });

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
  const hayCambiosUrgente = Object.keys(cambios).length > 0;
  const hayCambiosRepo = repoEditable && formRepo.hayCambios;
  const regla = producto.reposicionRegla;

  async function handleGuardar() {
    if (!hayCambiosUrgente && !hayCambiosRepo) {
      onOpenChange(false);
      return;
    }
    setGuardando(true);
    try {
      let guardadosRepo = 0;
      if (hayCambiosRepo) {
        const res = await formRepo.guardar();
        if (res === null) return;
        guardadosRepo = res;
      }
      if (hayCambiosUrgente && !(await onGuardarUrgente(cambios, hayCambiosRepo ? null : "Cantidad guardada."))) {
        return;
      }
      if (hayCambiosRepo) {
        toast.success(
          hayCambiosUrgente
            ? "Cambios guardados."
            : guardadosRepo > 1
              ? `Configuración guardada para ${guardadosRepo} producto(s).`
              : "Configuración guardada."
        );
        router.refresh();
      }
      onOpenChange(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="Cant. a Pedir"
        className="max-w-[56rem]"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              onClick={handleGuardar}
              disabled={guardando || (!hayCambiosUrgente && !hayCambiosRepo)}
            >
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        }
      >
        <div className="flex w-full flex-col gap-4 text-center">
          <p className="text-sm font-medium text-foreground">{producto.descripcion}</p>

          <section className="modal-seccion-formulario flex flex-col gap-3">
            <h3 className={TITULO_SECCION_CLASS}>Urgente</h3>
            <div className="grid grid-cols-2 items-center gap-x-4 gap-y-2">
              <ModalMicroLabel className="text-right">PROVEEDOR</ModalMicroLabel>
              <ModalMicroLabel className={cn(ANCHO_CANT_URGENTE_CLASS, "justify-self-start text-center")}>
                CANT. A PEDIR
              </ModalMicroLabel>
              {miembros.map((m, idx) => (
                <div key={m.codExt} className="contents">
                  <span className="truncate text-right text-sm text-foreground">
                    {m.prefijo?.trim() || `Proveedor ${idx + 1}`}
                    {miembros.length > 1 && idx === 0 ? (
                      <span className="ml-2 text-xs text-muted-foreground">(prioridad por costo)</span>
                    ) : null}
                  </span>
                  <EnteroStepperInput
                    variante="formulario"
                    className={cn(ANCHO_CANT_URGENTE_CLASS, "justify-self-start")}
                    min={0}
                    value={valores[m.codExt] ?? ""}
                    autoFocus={idx === 0}
                    onChange={(next) =>
                      setValores((prev) => ({ ...prev, [m.codExt]: next.replace(/\D/g, "") }))
                    }
                    onEnter={() => void handleGuardar()}
                    ariaLabel={`cantidad urgente ${m.prefijo ?? ""}`.trim()}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="modal-seccion-formulario flex flex-col gap-3">
            <h3 className={TITULO_SECCION_CLASS}>Reposición</h3>
            {repoEditable ? (
              <>
                {regla?.omitidaEnPedido ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      No se pide en este pedido; vuelve a pedirse al generar el pedido del proveedor.
                    </p>
                    <Button type="button" size="sm" onClick={() => onReactivarReposicion(producto)}>
                      Volver a Pedir
                    </Button>
                  </div>
                ) : null}
                <ReposicionConfigCampos
                  form={formRepo}
                  item={itemRepo}
                  sucursal={sucursal || undefined}
                  disabled={guardando}
                  aplicarPisoCorp
                />
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
