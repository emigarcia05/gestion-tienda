"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import {
  confirmarCompraTintometricoVentaAction,
  confirmarCompraUrgenteVentaAction,
  listarProveedoresCompraVentaAction,
} from "@/actions/ventaMovimientosStock";
import { crearTransferenciaApi, pedirRefrescoNotificaciones } from "@/lib/stockTransferenciasClient";
import { fmtCantidad, fmtPrecio } from "@/lib/format";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
import type { SucursalTransf } from "@/lib/transfDepositosTypes";
import {
  sumarColoresMovimiento,
  type ItemMovimientoVenta,
  type PlanMovimientosVenta,
  type ProveedorCompraVentaItem,
} from "@/lib/ventaMovimientosStock";
import { cn } from "@/lib/utils";

type AccionTransferencia = "nada" | "transferir" | "proveedor";
type AccionCompra = "nada" | "comprar";

const OPCIONES_TRANSFERENCIA: { value: AccionTransferencia; label: string }[] = [
  { value: "nada", label: "No hacer nada" },
  { value: "transferir", label: "Confirmar Transferencia" },
  { value: "proveedor", label: "Pedir a Proveedor" },
];

const SECCION_TITULO_CLASS = "text-center text-xs font-bold uppercase tracking-wide text-foreground";
const FILA_GRID_CLASS = "grid grid-cols-[minmax(0,1fr)_4.5rem_auto] items-center gap-3";

function claveTransf(origen: SucursalTransf, codTienda: string): string {
  return `${origen}|${codTienda}`;
}

function OpcionesAccion<T extends string>({
  opciones,
  valor,
  onChange,
  disabled,
  ariaLabel,
}: {
  opciones: { value: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap justify-end gap-1.5">
      {opciones.map((o) => (
        <Button
          key={o.value}
          type="button"
          size="sm"
          role="radio"
          aria-checked={valor === o.value}
          variant={valor === o.value ? "default" : "outline"}
          className={cn(valor !== o.value && "border-primary")}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function CeldaItem({ item }: { item: ItemMovimientoVenta }) {
  return (
    <span className="min-w-0 text-left text-sm text-foreground">
      <span className="tabular-nums text-muted-foreground">{item.codTienda}</span>{" "}
      <span className="uppercase">{item.descripcion}</span>
      {item.colores.length > 0 ? (
        <span className="block text-xs uppercase text-muted-foreground">
          {item.colores.map((c) => `COD. ${c.codColor} × ${fmtCantidad(c.cantidad)}`).join(" · ")}
        </span>
      ) : null}
    </span>
  );
}

function detalleProveedor(p: ProveedorCompraVentaItem): string {
  return p.tipo === "lista"
    ? `$${fmtPrecio(p.pxCompra)}`
    : `COEF. ${p.coeficiente.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanMovimientosVenta | null;
  /** Sucursal de la venta: destino de las transferencias y del pedido urgente. */
  sucursalDestino: SucursalTransf | null;
}

/**
 * Tras registrar una venta: ítems que la sucursal no cubre. **TRANSFERENCIAS** (por sucursal origen:
 * No hacer nada / Confirmar Transferencia / Pedir a Proveedor) y **COMPRAS** (No hacer nada /
 * Confirmar Compra → suma al PEDIDO URGENTE; con varios proveedores, elegir a cuál).
 */
export default function FacturaMovimientosVentaModal({ open, onOpenChange, plan, sucursalDestino }: Props) {
  const [accTransf, setAccTransf] = useState<Record<string, AccionTransferencia>>({});
  const [accCompra, setAccCompra] = useState<Record<string, AccionCompra>>({});
  const [provElegido, setProvElegido] = useState<Record<string, string>>({});
  const [proveedores, setProveedores] = useState<Record<string, ProveedorCompraVentaItem[]> | null>(null);
  const [hechos, setHechos] = useState<Set<string>>(new Set());
  const [selectorCod, setSelectorCod] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const codigosKey = useMemo(() => {
    if (!plan) return "";
    const cods = new Set<string>();
    for (const g of plan.transferencias) for (const i of g.items) cods.add(i.codTienda);
    for (const i of plan.compras) cods.add(i.codTienda);
    return [...cods].sort().join("|");
  }, [plan]);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setAccTransf({});
      setAccCompra({});
      setProvElegido({});
      setProveedores(null);
      setHechos(new Set());
      setSelectorCod(null);
    });
    if (!codigosKey) return;
    let cancelado = false;
    void listarProveedoresCompraVentaAction({ codTiendas: codigosKey.split("|") }).then((res) => {
      if (cancelado) return;
      if (!res.ok) {
        toast.error(res.error);
        setProveedores({});
        return;
      }
      setProveedores(res.data);
    });
    return () => {
      cancelado = true;
    };
  }, [open, codigosKey]);

  /** COMPRAS = faltante del plan + lo que se pasó desde TRANSFERENCIAS con «Pedir a Proveedor». */
  const compras = useMemo(() => {
    const porCod = new Map<string, ItemMovimientoVenta>();
    for (const i of plan?.compras ?? []) porCod.set(i.codTienda, { ...i });
    for (const g of plan?.transferencias ?? []) {
      for (const i of g.items) {
        if (accTransf[claveTransf(g.origenCodigo, i.codTienda)] !== "proveedor") continue;
        const previo = porCod.get(i.codTienda);
        if (previo) {
          previo.cantidad = Math.round((previo.cantidad + i.cantidad) * 10) / 10;
          previo.colores = sumarColoresMovimiento(previo.colores, i.colores);
        } else porCod.set(i.codTienda, { ...i });
      }
    }
    return [...porCod.values()];
  }, [plan, accTransf]);

  if (!plan || !sucursalDestino) return null;

  const hayPendiente =
    plan.transferencias.some((g) =>
      g.items.some((i) => {
        const k = claveTransf(g.origenCodigo, i.codTienda);
        return accTransf[k] === "transferir" && !hechos.has(`t|${k}`);
      })
    ) || compras.some((c) => accCompra[c.codTienda] === "comprar" && !hechos.has(`c|${c.codTienda}`));

  function esCompraTintometrica(item: ItemMovimientoVenta): boolean {
    const tipo = proveedores?.[item.codTienda]?.[0]?.tipo;
    return tipo ? tipo === "tintometrico" : item.colores.length > 0;
  }

  function elegirAccionCompra(codTienda: string, accion: AccionCompra) {
    if (accion === "nada") {
      setAccCompra((prev) => ({ ...prev, [codTienda]: "nada" }));
      return;
    }
    if (proveedores == null) {
      toast.error("Cargando proveedores...");
      return;
    }
    const lista = proveedores[codTienda] ?? [];
    if (lista.length === 0) {
      toast.error("El ítem no tiene proveedores disponibles para pedir.");
      return;
    }
    if (lista[0].tipo === "tintometrico" && !compras.find((c) => c.codTienda === codTienda)?.colores.length) {
      toast.error("El ítem tintométrico no tiene COD. COLOR; pedilo desde Pedir Mercadería.");
      return;
    }
    if (lista.length === 1) {
      setProvElegido((prev) => ({ ...prev, [codTienda]: lista[0].id }));
      setAccCompra((prev) => ({ ...prev, [codTienda]: "comprar" }));
      return;
    }
    setSelectorCod(codTienda);
  }

  function elegirProveedor(id: string) {
    if (!selectorCod) return;
    const cod = selectorCod;
    setProvElegido((prev) => ({ ...prev, [cod]: id }));
    setAccCompra((prev) => ({ ...prev, [cod]: "comprar" }));
    setSelectorCod(null);
  }

  async function confirmar() {
    if (!plan || !sucursalDestino) return;
    const usuario = leerUsuarioSesion();
    if (!usuario) {
      toast.error("Elegí un usuario.");
      return;
    }
    setPending(true);
    const nuevosHechos = new Set(hechos);
    let hayErrores = false;
    try {
      for (const g of plan.transferencias) {
        const items = g.items.filter((i) => {
          const k = claveTransf(g.origenCodigo, i.codTienda);
          return accTransf[k] === "transferir" && !nuevosHechos.has(`t|${k}`);
        });
        if (items.length === 0) continue;
        const res = await crearTransferenciaApi({
          origenCodigo: g.origenCodigo,
          destinoCodigo: sucursalDestino,
          personalId: usuario.idPersonal,
          items: items.map((i) => ({ codItem: i.codTienda, cantidad: i.cantidad })),
        });
        if (!res.ok) {
          hayErrores = true;
          toast.error(`Transferencia desde ${g.origenNombre.toLocaleUpperCase("es")}: ${res.error}`);
          continue;
        }
        for (const i of items) nuevosHechos.add(`t|${claveTransf(g.origenCodigo, i.codTienda)}`);
        pedirRefrescoNotificaciones();
        toast.success(
          res.data.actualizada
            ? `Se sumó a la transferencia pendiente N° ${res.data.numero} de ${g.origenNombre.toLocaleUpperCase("es")}.`
            : `Transferencia N° ${res.data.numero} pedida a ${g.origenNombre.toLocaleUpperCase("es")}.`,
          { description: `Queda pendiente hasta que ${res.data.confirmaNombre} la acepte.` }
        );
      }

      for (const c of compras) {
        if (accCompra[c.codTienda] !== "comprar" || nuevosHechos.has(`c|${c.codTienda}`)) continue;
        const prov = proveedores?.[c.codTienda]?.find((p) => p.id === provElegido[c.codTienda]);
        if (!prov) continue;
        if (prov.tipo === "tintometrico") {
          const res = await confirmarCompraTintometricoVentaAction({
            sucursal: sucursalDestino,
            codTienda: c.codTienda,
            proveedorId: prov.id,
            colores: c.colores,
          });
          if (!res.ok) {
            hayErrores = true;
            toast.error(`${c.descripcion}: ${res.error}`);
            continue;
          }
          nuevosHechos.add(`c|${c.codTienda}`);
          toast.success(
            `${c.descripcion}: ${fmtCantidad(res.data.cantAgregada)} un. al pedido tintométrico de ${prov.proveedor}.`
          );
          continue;
        }
        const res = await confirmarCompraUrgenteVentaAction({
          sucursal: sucursalDestino,
          codTienda: c.codTienda,
          listaPrecioProveedorId: prov.id,
          cantidad: c.cantidad,
        });
        if (!res.ok) {
          hayErrores = true;
          toast.error(`${c.descripcion}: ${res.error}`);
          continue;
        }
        nuevosHechos.add(`c|${c.codTienda}`);
        toast.success(`${c.descripcion}: pedido urgente en ${fmtCantidad(res.data.cantTotal)} un.`);
      }
    } finally {
      setHechos(nuevosHechos);
      setPending(false);
    }
    if (!hayErrores) onOpenChange(false);
  }

  const provSelector = selectorCod ? (proveedores?.[selectorCod] ?? []) : [];
  const itemSelector = selectorCod ? compras.find((c) => c.codTienda === selectorCod) : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && (selectorCod != null || pending)) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        title="MOVIMIENTOS"
        size="xl"
        className="max-w-[60rem]"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cerrar
            </Button>
            <Button type="button" onClick={() => void confirmar()} disabled={pending || !hayPendiente}>
              {pending ? "Confirmando..." : "Confirmar"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {plan.transferencias.length > 0 ? (
            <section className="modal-seccion-formulario flex flex-col gap-3">
              <h3 className={SECCION_TITULO_CLASS}>TRANSFERENCIAS</h3>
              {plan.transferencias.map((g) => (
                <div key={g.origenCodigo} className="flex flex-col gap-2">
                  <p className="text-sm font-semibold uppercase text-foreground">
                    Pedir a {g.origenNombre}
                  </p>
                  <div className={FILA_GRID_CLASS}>
                    <ModalMicroLabel>ÍTEM</ModalMicroLabel>
                    <ModalMicroLabel align="center">CANT.</ModalMicroLabel>
                    <span />
                  </div>
                  {g.items.map((i) => {
                    const k = claveTransf(g.origenCodigo, i.codTienda);
                    const hecho = hechos.has(`t|${k}`);
                    return (
                      <div key={k} className={FILA_GRID_CLASS}>
                        <CeldaItem item={i} />
                        <span className="text-center text-sm font-bold tabular-nums">{fmtCantidad(i.cantidad)}</span>
                        <OpcionesAccion
                          opciones={OPCIONES_TRANSFERENCIA}
                          valor={accTransf[k] ?? "nada"}
                          onChange={(v) => setAccTransf((prev) => ({ ...prev, [k]: v }))}
                          disabled={pending || hecho}
                          ariaLabel={`Acción para ${i.descripcion} desde ${g.origenNombre}`}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </section>
          ) : null}

          <section className="modal-seccion-formulario flex flex-col gap-2">
            <h3 className={SECCION_TITULO_CLASS}>COMPRAS</h3>
            {compras.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">SIN COMPRAS.</p>
            ) : (
              <>
                <div className={FILA_GRID_CLASS}>
                  <ModalMicroLabel>ÍTEM</ModalMicroLabel>
                  <ModalMicroLabel align="center">CANT.</ModalMicroLabel>
                  <span />
                </div>
                {compras.map((c) => {
                  const hecho = hechos.has(`c|${c.codTienda}`);
                  const accion = accCompra[c.codTienda] ?? "nada";
                  const prov =
                    accion === "comprar"
                      ? proveedores?.[c.codTienda]?.find((p) => p.id === provElegido[c.codTienda])
                      : undefined;
                  return (
                    <div key={c.codTienda} className={FILA_GRID_CLASS}>
                      <div className="flex min-w-0 flex-col">
                        <CeldaItem item={c} />
                        {prov ? (
                          <span className="text-xs uppercase text-muted-foreground">
                            {prov.tipo === "tintometrico" ? "Pedido tintométrico" : "Pedido urgente"} a{" "}
                            {prov.proveedor}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-center text-sm font-bold tabular-nums">{fmtCantidad(c.cantidad)}</span>
                      <Button
                        type="button"
                        size="sm"
                        aria-pressed={accion === "comprar"}
                        variant={accion === "comprar" ? "default" : "outline"}
                        className={cn("justify-self-end", accion !== "comprar" && "border-primary")}
                        disabled={pending || hecho}
                        onClick={() => elegirAccionCompra(c.codTienda, accion === "comprar" ? "nada" : "comprar")}
                      >
                        {esCompraTintometrica(c) ? "AGREGAR A TINTOMETRICO" : "AGREGAR A PED. URGENTE"}
                      </Button>
                    </div>
                  );
                })}
              </>
            )}
          </section>
        </div>

        <Dialog open={selectorCod != null} onOpenChange={(o) => !o && setSelectorCod(null)}>
          <AppModal
            title="ELEGIR PROVEEDOR"
            size="sm"
            actions={
              <Button type="button" variant="outline" onClick={() => setSelectorCod(null)}>
                Cancelar
              </Button>
            }
          >
            <div className="flex flex-col gap-2">
              {itemSelector ? (
                <p className="text-center text-sm font-medium uppercase text-foreground">
                  {itemSelector.descripcion} · {fmtCantidad(itemSelector.cantidad)} un.
                </p>
              ) : null}
              {provSelector.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="outline"
                  className="h-auto justify-between gap-3 border-primary py-2"
                  onClick={() => elegirProveedor(p.id)}
                >
                  <span className="uppercase">
                    {p.proveedor}
                    {p.tipo === "lista" && p.esCxElegido ? (
                      <span className="ml-2 text-xs text-muted-foreground">(CX)</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums">{detalleProveedor(p)}</span>
                </Button>
              ))}
            </div>
          </AppModal>
        </Dialog>
      </AppModal>
    </Dialog>
  );
}
