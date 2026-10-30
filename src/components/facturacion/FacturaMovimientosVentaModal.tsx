"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AppModal from "@/components/shared/AppModal";
import EnteroStepperInput from "@/components/shared/EnteroStepperInput";
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
  type TransferenciaVentaItem,
} from "@/lib/ventaMovimientosStock";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

type AccionTransferencia = "nada" | "transferir" | "proveedor";
type AccionCompra = "nada" | "comprar";

const OPCIONES_TRANSFERENCIA: { value: AccionTransferencia; lineas: [string, string] }[] = [
  { value: "nada", lineas: ["Ni transferencia", "ni compra"] },
  { value: "transferir", lineas: ["Pedir", "transferencia"] },
  { value: "proveedor", lineas: ["Pedir", "a proveedor"] },
];

const SECCION_TITULO_CLASS = "text-center text-xs font-bold uppercase tracking-wide text-foreground";
const FILA_GRID_CLASS = "grid grid-cols-[minmax(0,1fr)_8rem_22rem] items-center gap-3";
const FILA_COMPRA_GRID_CLASS = "grid grid-cols-[minmax(0,1fr)_8rem_11rem_13rem] items-center gap-3";

function claveTransf(origen: SucursalTransf, codTienda: string): string {
  return `${origen}|${codTienda}`;
}

/** Cantidad editada (entero entre 1 y `max`) o la del plan si no se editó o el texto no es válido. */
function cantidadEfectiva(original: number, editada: string | undefined, max?: number): number {
  if (editada == null) return original;
  const n = Number(editada);
  if (!Number.isInteger(n) || n < 1) return original;
  return max != null ? Math.min(n, max) : n;
}

/** Tope entero para transferir: no se puede pedir más que el stock de la sucursal origen. */
function maxTransferible(item: TransferenciaVentaItem): number {
  return Math.floor(item.stockOrigen);
}

/** La edición de una transferencia sólo aplica a ítems sin COD. COLOR y con stock entero ≥ 1 en origen. */
function transferenciaEditable(item: TransferenciaVentaItem): boolean {
  return item.colores.length === 0 && maxTransferible(item) >= 1;
}

/** Control segmentado: las opciones ocupan el mismo ancho; ninguna elegida hasta que el usuario decide. */
function OpcionesAccion<T extends string>({
  opciones,
  valor,
  onChange,
  disabled,
  ariaLabel,
}: {
  opciones: { value: T; lineas: [string, string] }[];
  valor: T | undefined;
  onChange: (v: T) => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-3 divide-x divide-primary overflow-hidden rounded-md border border-primary"
    >
      {opciones.map((o) => {
        const elegida = valor === o.value;
        return (
          <Button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={elegida}
            variant={elegida ? "default" : "ghost"}
            className={cn(
              "h-auto min-h-10 flex-col gap-0 whitespace-normal rounded-none px-2 py-1 text-xs font-semibold uppercase leading-tight shadow-none",
              !elegida && "text-primary hover:text-primary"
            )}
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            <span>{o.lineas[0]}</span>
            <span>{o.lineas[1]}</span>
          </Button>
        );
      })}
    </div>
  );
}

/** CANT.: número + lápiz; al editar, stepper + / − (entero entre 1 y `max`). */
function CantidadEditable({
  cantidad,
  editable,
  editando,
  valor,
  max,
  onEditar,
  onChange,
  disabled,
  ariaLabel,
}: {
  cantidad: number;
  editable: boolean;
  editando: boolean;
  valor: string;
  max?: number;
  onEditar: () => void;
  onChange: (next: string) => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  if (editable && editando) {
    return (
      <EnteroStepperInput
        variante="formulario"
        className="mx-auto w-24"
        value={valor}
        onChange={onChange}
        min={1}
        max={max}
        allowEmpty={false}
        clampAlMinimo
        disabled={disabled}
        ariaLabel={ariaLabel}
      />
    );
  }
  return (
    <div className={cn(TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS, "h-9 flex-nowrap")}>
      <span className="text-sm font-bold tabular-nums">{fmtCantidad(cantidad)}</span>
      {editable ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
          aria-label={`Editar ${ariaLabel}`}
          disabled={disabled}
          onClick={onEditar}
        >
          <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} />
        </Button>
      ) : null}
    </div>
  );
}

function CeldaItem({ item, detalle }: { item: ItemMovimientoVenta; detalle?: string }) {
  return (
    <span className="min-w-0 text-left text-sm text-foreground">
      <span className="tabular-nums text-muted-foreground">{item.codTienda}</span>{" "}
      <span className="uppercase">{item.descripcion}</span>
      {item.colores.length > 0 ? (
        <span className="block text-xs uppercase text-muted-foreground">
          {item.colores.map((c) => `COD. ${c.codColor} × ${fmtCantidad(c.cantidad)}`).join(" · ")}
        </span>
      ) : null}
      {detalle ? <span className="block text-xs uppercase text-muted-foreground">{detalle}</span> : null}
    </span>
  );
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
 * Ni transferencia ni compra / Pedir transferencia / Pedir a proveedor, sin opción por defecto) y
 * **COMPRAS** (botón conmutable → suma al PEDIDO URGENTE; con varios proveedores, elegir a cuál).
 */
export default function FacturaMovimientosVentaModal({ open, onOpenChange, plan, sucursalDestino }: Props) {
  const [accTransf, setAccTransf] = useState<Record<string, AccionTransferencia>>({});
  const [accCompra, setAccCompra] = useState<Record<string, AccionCompra>>({});
  /** Cantidades editadas (texto del stepper) y filas en modo edición; clave = `claveTransf` / `codTienda`. */
  const [cantTransf, setCantTransf] = useState<Record<string, string>>({});
  const [cantCompra, setCantCompra] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<Set<string>>(new Set());
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
      setCantTransf({});
      setCantCompra({});
      setEditando(new Set());
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

  /**
   * COMPRAS = faltante del plan + lo que se pasó desde TRANSFERENCIAS con «Pedir a Proveedor»
   * + lo que se dejó de transferir al bajar la cantidad de «Pedir transferencia».
   */
  const compras = useMemo(() => {
    const porCod = new Map<string, ItemMovimientoVenta>();
    const sumar = (item: ItemMovimientoVenta) => {
      const previo = porCod.get(item.codTienda);
      if (previo) {
        previo.cantidad = Math.round((previo.cantidad + item.cantidad) * 10) / 10;
        previo.colores = sumarColoresMovimiento(previo.colores, item.colores);
      } else porCod.set(item.codTienda, { ...item });
    };
    for (const i of plan?.compras ?? []) sumar(i);
    for (const g of plan?.transferencias ?? []) {
      for (const i of g.items) {
        const k = claveTransf(g.origenCodigo, i.codTienda);
        const accion = accTransf[k];
        if (accion === "proveedor") {
          sumar({ codTienda: i.codTienda, descripcion: i.descripcion, cantidad: i.cantidad, colores: i.colores });
          continue;
        }
        if (accion !== "transferir") continue;
        const resto =
          Math.round((i.cantidad - cantidadEfectiva(i.cantidad, cantTransf[k], maxTransferible(i))) * 10) / 10;
        if (resto > 0) sumar({ codTienda: i.codTienda, descripcion: i.descripcion, cantidad: resto, colores: [] });
      }
    }
    return [...porCod.values()];
  }, [plan, accTransf, cantTransf]);

  if (!plan || !sucursalDestino) return null;

  const hayPendiente =
    plan.transferencias.some((g) =>
      g.items.some((i) => {
        const k = claveTransf(g.origenCodigo, i.codTienda);
        return accTransf[k] === "transferir" && !hechos.has(`t|${k}`);
      })
    ) || compras.some((c) => accCompra[c.codTienda] === "comprar" && !hechos.has(`c|${c.codTienda}`));

  /** Cada transferencia necesita una decisión explícita (incluida «Ni transferencia ni compra»). */
  const todasDecididas = plan.transferencias.every((g) =>
    g.items.every((i) => accTransf[claveTransf(g.origenCodigo, i.codTienda)] != null)
  );

  function esCompraTintometrica(item: ItemMovimientoVenta): boolean {
    const tipo = proveedores?.[item.codTienda]?.[0]?.tipo;
    return tipo ? tipo === "tintometrico" : item.colores.length > 0;
  }

  function cantidadCompra(c: ItemMovimientoVenta): number {
    return esCompraTintometrica(c) ? c.cantidad : cantidadEfectiva(c.cantidad, cantCompra[c.codTienda]);
  }

  function quitarEdicion(clave: string) {
    setEditando((prev) => {
      if (!prev.has(clave)) return prev;
      const next = new Set(prev);
      next.delete(clave);
      return next;
    });
  }

  function iniciarEdicion(clave: string, cantidad: number, setCant: (v: string) => void, max?: number) {
    const inicial = Math.max(1, Math.round(cantidad));
    setCant(String(max != null ? Math.min(inicial, max) : inicial));
    setEditando((prev) => new Set(prev).add(clave));
  }

  /** La cantidad de COMPRAS del ítem cambió (acción o cantidad de transferencia): vuelve a la calculada. */
  function descartarCantCompra(codTienda: string) {
    setCantCompra(({ [codTienda]: _quitada, ...resto }) => resto);
    quitarEdicion(`c|${codTienda}`);
  }

  function elegirAccionTransf(k: string, codTienda: string, accion: AccionTransferencia) {
    setAccTransf((prev) => ({ ...prev, [k]: accion }));
    if (accion !== "transferir") {
      setCantTransf(({ [k]: _quitada, ...resto }) => resto);
      quitarEdicion(`t|${k}`);
    }
    descartarCantCompra(codTienda);
  }

  function cambiarCantTransf(k: string, codTienda: string, valor: string) {
    setCantTransf((prev) => ({ ...prev, [k]: valor }));
    descartarCantCompra(codTienda);
  }

  function elegirAccionCompra(codTienda: string, accion: AccionCompra) {
    if (accion === "nada") {
      setAccCompra((prev) => ({ ...prev, [codTienda]: "nada" }));
      descartarCantCompra(codTienda);
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
    if (!hayPendiente) {
      onOpenChange(false);
      return;
    }
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
          items: items.map((i) => ({
            codItem: i.codTienda,
            cantidad: cantidadEfectiva(
              i.cantidad,
              cantTransf[claveTransf(g.origenCodigo, i.codTienda)],
              maxTransferible(i)
            ),
          })),
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
          cantidad: cantidadCompra(c),
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
            <Button type="button" onClick={() => void confirmar()} disabled={pending || !todasDecididas}>
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
                        <CeldaItem
                          item={i}
                          detalle={`Stock en ${g.origenNombre}: ${fmtCantidad(i.stockOrigen)}`}
                        />
                        <CantidadEditable
                          cantidad={cantidadEfectiva(i.cantidad, cantTransf[k], maxTransferible(i))}
                          editable={accTransf[k] === "transferir" && transferenciaEditable(i)}
                          editando={editando.has(`t|${k}`)}
                          valor={cantTransf[k] ?? ""}
                          max={maxTransferible(i)}
                          onEditar={() =>
                            iniciarEdicion(
                              `t|${k}`,
                              i.cantidad,
                              (v) => cambiarCantTransf(k, i.codTienda, v),
                              maxTransferible(i)
                            )
                          }
                          onChange={(v) => cambiarCantTransf(k, i.codTienda, v)}
                          disabled={pending || hecho}
                          ariaLabel={`cantidad a transferir de ${i.descripcion}`}
                        />
                        <OpcionesAccion
                          opciones={OPCIONES_TRANSFERENCIA}
                          valor={accTransf[k]}
                          onChange={(v) => elegirAccionTransf(k, i.codTienda, v)}
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
                <div className={FILA_COMPRA_GRID_CLASS}>
                  <ModalMicroLabel>DESCRIPCIÓN</ModalMicroLabel>
                  <ModalMicroLabel align="center">CANT.</ModalMicroLabel>
                  <ModalMicroLabel>PROVEEDOR</ModalMicroLabel>
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
                    <div key={c.codTienda} className={FILA_COMPRA_GRID_CLASS}>
                      <CeldaItem item={c} />
                      <CantidadEditable
                        cantidad={cantidadCompra(c)}
                        editable={accion === "comprar" && !esCompraTintometrica(c)}
                        editando={editando.has(`c|${c.codTienda}`)}
                        valor={cantCompra[c.codTienda] ?? ""}
                        onEditar={() =>
                          iniciarEdicion(`c|${c.codTienda}`, c.cantidad, (v) =>
                            setCantCompra((prev) => ({ ...prev, [c.codTienda]: v }))
                          )
                        }
                        onChange={(v) => setCantCompra((prev) => ({ ...prev, [c.codTienda]: v }))}
                        disabled={pending || hecho}
                        ariaLabel={`cantidad a pedir de ${c.descripcion}`}
                      />
                      <span className="truncate text-sm uppercase text-foreground" title={prov?.proveedor}>
                        {prov?.proveedor ?? ""}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        aria-pressed={accion === "comprar"}
                        variant={accion === "comprar" ? "default" : "outline"}
                        className={cn("w-full", accion !== "comprar" && "border-primary")}
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
                  {itemSelector.descripcion} · {fmtCantidad(cantidadCompra(itemSelector))} un.
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
                  {p.tipo === "lista" ? <span className="tabular-nums">${fmtPrecio(p.pxCompra)}</span> : null}
                </Button>
              ))}
            </div>
          </AppModal>
        </Dialog>
      </AppModal>
    </Dialog>
  );
}
