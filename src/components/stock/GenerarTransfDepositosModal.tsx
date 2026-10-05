"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import { parseCantidadUnDecimal, formatCantidadInputValor } from "@/lib/cantidadUnDecimal";
import { fmtCantidad } from "@/lib/format";
import { parseSucursalPreferida } from "@/lib/sucursalPreferida";
import {
  borrarBorradorTransfDepositos,
  enfocarDuxTransferenciaDepositosTab,
  leerBorradorTransfDepositos,
  parTransfConSucursalUsuario,
} from "@/lib/transfDepositosControl";
import {
  SUCURSALES_TRANSF_DEPOSITOS_UI,
  type LoteAbiertoTransfDepositoItemDto,
  type SucursalTransf as Sucursal,
  type SucursalTransfDepositoOptionDto,
} from "@/lib/transfDepositosTypes";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
import {
  crearTransferenciaApi,
  pedirRefrescoNotificaciones,
} from "@/lib/stockTransferenciasClient";
import {
  TablaControlItemCelda,
  TablaControlItemHead,
} from "@/components/shared/TablaControlItem";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Código de sucursal origen de la página. */
  origenCodigo: Sucursal | null;
  /** Destino de la página (si hay): precarga el lote abierto en la tabla. */
  destinoCodigo: Sucursal | null;
  onTransferido?: () => void;
}

const BOTON_COPIAR_CELDA_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "!size-7 max-h-7 min-h-7 min-w-7 shrink-0 !p-0"
);

async function copiarDatoTransf(texto: string, toastTitle: string): Promise<void> {
  const t = texto.trim();
  if (t === "") return;
  try {
    await navigator.clipboard.writeText(t);
    toast.success(toastTitle, { description: t });
    enfocarDuxTransferenciaDepositosTab();
  } catch {
    toast.error("No se pudo copiar.");
  }
}

/**
 * Modal **Generar Transf.**: dos selectores **SUC. ORIGEN** y **SUC. DESTINO**
 * (una punta = sucursal del usuario; la otra se fija y no se edita; cada sucursal es depósito);
 * al abrir, si la página ya tiene destino, precarga el lote abierto en la tabla
 * (reabrir el modal sin haber pulsado Confirmar Transf. muestra los mismos ítems);
 * al elegir destino abre (o enfoca) transferencia de depósitos en DUX;
 * tabla Control de ítem / COD. TIENDA (**OK** a la izquierda del código) / DESCRIPCIÓN / CANTIDAD (copiar a la derecha);
 * cada copiar (y OK) enfoca la pestaña DUX ya abierta sin recargar;
 * checklist local hasta **Confirmar Transf.**: crea `stock_transferencias` PENDIENTE
 * (sin ledger; la otra sucursal acepta desde NOTIFICACIONES) y borra el borrador.
 * Cabecera del modal (selectores) y `thead` fijos; scroll solo en `.contenedor-tabla-gestion`.
 */
export default function GenerarTransfDepositosModal({
  open,
  onOpenChange,
  origenCodigo,
  destinoCodigo,
  onTransferido,
}: Props) {
  const [sucursales, setSucursales] = useState<SucursalTransfDepositoOptionDto[]>(
    []
  );
  const [sucOrigenId, setSucOrigenId] = useState<string | null>(null);
  const [sucDestinoId, setSucDestinoId] = useState<string | null>(null);
  const [items, setItems] = useState<LoteAbiertoTransfDepositoItemDto[]>([]);
  const [okPorCodTienda, setOkPorCodTienda] = useState<Record<string, boolean>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sucursalUsuario, setSucursalUsuario] = useState<Sucursal | null>(null);
  const [usuarioListo, setUsuarioListo] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setSucursalUsuario(leerUsuarioSesion()?.sucursalPorDefecto ?? null);
      setUsuarioListo(true);
    });
  }, []);

  const origenes = useMemo(() => {
    return sucursales.filter(
      (s) => s.tieneDeposito || s.codigo === origenCodigo
    );
  }, [sucursales, origenCodigo]);

  const destinos = useMemo(
    () =>
      sucursales.filter((s) => s.tieneDeposito && s.id !== sucOrigenId),
    [sucursales, sucOrigenId]
  );

  const origenCodigoSel = parseSucursalPreferida(
    sucursales.find((s) => s.id === sucOrigenId)?.codigo ?? null
  );
  const destinoCodigoSel = parseSucursalPreferida(
    sucursales.find((s) => s.id === sucDestinoId)?.codigo ?? null
  );
  const parLocks = sucursalUsuario
    ? parTransfConSucursalUsuario(
        origenCodigoSel,
        destinoCodigoSel,
        sucursalUsuario
      )
    : { origenBloqueado: false, destinoBloqueado: false };

  const idsDesdeCodigos = useCallback(
    (
      lista: SucursalTransfDepositoOptionDto[],
      origenCod: Sucursal | null,
      destinoCod: Sucursal | null
    ): { origenId: string | null; destinoId: string | null } => {
      const par = sucursalUsuario
        ? parTransfConSucursalUsuario(origenCod, destinoCod, sucursalUsuario)
        : { origen: origenCod, destino: destinoCod };
      return {
        origenId: par.origen
          ? lista.find((s) => s.codigo === par.origen)?.id ?? null
          : null,
        destinoId: par.destino
          ? lista.find((s) => s.codigo === par.destino)?.id ?? null
          : null,
      };
    },
    [sucursalUsuario]
  );

  const cargarItems = useCallback(
    async (origenId: string, destinoId: string) => {
      const origenCod = parseSucursalPreferida(origenId);
      const destinoCod = parseSucursalPreferida(destinoId);
      if (!origenCod || !destinoCod) {
        setError("Sucursal origen o destino inválida.");
        setItems([]);
        setOkPorCodTienda({});
        return;
      }
      const borrador = leerBorradorTransfDepositos(origenCod, destinoCod);
      const lote: LoteAbiertoTransfDepositoItemDto[] = [];
      for (const [codTienda, item] of Object.entries(borrador)) {
        const cantidad = parseCantidadUnDecimal(item.cantidad, { min: 0.1 });
        if (cantidad == null || cantidad <= 0) continue;
        lote.push({
          codTienda,
          descripcionTienda: item.descripcion,
          cantidad,
        });
      }
      setError(null);
      setItems(lote);
      setOkPorCodTienda({});
    },
    []
  );

  useEffect(() => {
    if (!open || !usuarioListo) return;
    let cancelled = false;

    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      setItems([]);
      setOkPorCodTienda({});
      setSucOrigenId(null);
      setSucDestinoId(null);
    });

    void (async () => {
      if (cancelled) return;
      setSucursales(SUCURSALES_TRANSF_DEPOSITOS_UI);
      const ids = idsDesdeCodigos(
        SUCURSALES_TRANSF_DEPOSITOS_UI,
        origenCodigo,
        destinoCodigo
      );
      if (!ids.origenId) {
        setLoading(false);
        setError("Sucursal origen no encontrada.");
        return;
      }
      setSucOrigenId(ids.origenId);

      if (ids.destinoId) {
        setSucDestinoId(ids.destinoId);
        await cargarItems(ids.origenId, ids.destinoId);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, usuarioListo, origenCodigo, destinoCodigo, cargarItems, idsDesdeCodigos]);

  function aplicarParYCargar(
    origenCod: Sucursal | null,
    destinoCod: Sucursal | null
  ) {
    const ids = idsDesdeCodigos(sucursales, origenCod, destinoCod);
    const origenId = ids.origenId;
    const destinoId = ids.destinoId;
    setSucOrigenId(origenId);
    setSucDestinoId(destinoId);
    if (!origenId || !destinoId) {
      setItems([]);
      setOkPorCodTienda({});
      setError(null);
      return;
    }
    enfocarDuxTransferenciaDepositosTab();
    setLoading(true);
    startTransition(async () => {
      await cargarItems(origenId, destinoId);
      setLoading(false);
    });
  }

  function handleOrigenChange(value: string) {
    const next =
      value === "none" ? null : parseSucursalPreferida(
        sucursales.find((s) => s.id === value)?.codigo ?? null
      );
    aplicarParYCargar(next, destinoCodigoSel);
  }

  function handleDestinoChange(value: string) {
    const next =
      value === "none" ? null : parseSucursalPreferida(
        sucursales.find((s) => s.id === value)?.codigo ?? null
      );
    aplicarParYCargar(origenCodigoSel, next);
  }

  async function handleOkItem(codTienda: string) {
    if (okPorCodTienda[codTienda] === true) {
      setOkPorCodTienda((prev) => ({ ...prev, [codTienda]: false }));
      return;
    }
    try {
      await navigator.clipboard.writeText(codTienda);
    } catch {
      toast.error("No se pudo copiar el código de tienda.");
      return;
    }
    setOkPorCodTienda((prev) => ({ ...prev, [codTienda]: true }));
    toast.success("Cod. Tienda Copiado", { description: codTienda });
    enfocarDuxTransferenciaDepositosTab();
  }

  const todosOk =
    items.length > 0 && items.every((item) => okPorCodTienda[item.codTienda] === true);
  const puedeMarcar =
    sucOrigenId !== null &&
    sucDestinoId !== null &&
    todosOk &&
    !loading;

  function handleTransferido() {
    if (
      !sucOrigenId ||
      !sucDestinoId ||
      items.length === 0 ||
      !todosOk
    ) {
      return;
    }
    const origenCod = parseSucursalPreferida(sucOrigenId);
    const destinoCod = parseSucursalPreferida(sucDestinoId);
    if (!origenCod || !destinoCod) {
      toast.error("Sucursal origen o destino inválida.");
      return;
    }
    const usuario = leerUsuarioSesion();
    if (!usuario) {
      toast.error("Elegí un usuario.");
      return;
    }
    startTransition(async () => {
      const res = await crearTransferenciaApi({
        origenCodigo: origenCod,
        destinoCodigo: destinoCod,
        personalId: usuario.idPersonal,
        items: items.map((item) => ({
          codItem: item.codTienda,
          cantidad: item.cantidad,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      borrarBorradorTransfDepositos(origenCod, destinoCod);
      toast.success("Transferencia enviada.", {
        description: `Queda pendiente hasta que ${res.data.confirmaNombre} la acepte. El stock se registra al aceptarla.`,
      });
      pedirRefrescoNotificaciones();
      setItems([]);
      setOkPorCodTienda({});
      onTransferido?.();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="xl"
        className="h-[85vh] max-h-[85vh] max-w-[54rem]"
        title="Generar Transf."
        scrollBody={false}
        bodyClassName="flex min-h-0 flex-1 flex-col gap-4"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              onClick={handleTransferido}
              disabled={!puedeMarcar || isPending}
              className="disabled:cursor-not-allowed"
              title={
                puedeMarcar
                  ? "Enviar la transferencia para que la otra sucursal la acepte"
                  : "Marcá todos los ítems con OK"
              }
            >
              Confirmar Transf.
            </Button>
          </>
        }
      >
        <div className="flex shrink-0 flex-col gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel align="center">SUC. ORIGEN</ModalMicroLabel>
              <Select
                value={sucOrigenId ?? "none"}
                onValueChange={handleOrigenChange}
                disabled={isPending || parLocks.origenBloqueado}
              >
                <SelectTrigger
                  id="filtro-transf-origen-modal"
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                  aria-label="Sucursal origen"
                >
                  <SelectValue placeholder="SUC. ORIGEN" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value="none">SUC. ORIGEN</SelectItem>
                  {origenes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowRight
              className="mb-2 h-5 w-5 shrink-0 text-primary"
              aria-hidden
            />
            <div className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel align="center">SUC. DESTINO</ModalMicroLabel>
              <Select
                value={sucDestinoId ?? "none"}
                onValueChange={handleDestinoChange}
                disabled={!sucOrigenId || isPending || parLocks.destinoBloqueado}
              >
                <SelectTrigger
                  id="filtro-transf-destino-modal"
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                  aria-label="Sucursal destino"
                >
                  <SelectValue placeholder="SUC. DESTINO" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value="none">SUC. DESTINO</SelectItem>
                  {destinos.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div
          className="contenedor-tabla-gestion no-scroll-x min-h-0 flex-1"
          style={{ height: "auto" }}
        >
          {loading ? (
            <p className="text-sm text-foreground py-6 text-center">Cargando…</p>
          ) : null}

          {!loading && error ? (
            <p className="text-sm text-destructive py-6 text-center">{error}</p>
          ) : null}

          {!loading && !error && sucDestinoId === null ? (
            <p className="text-sm text-foreground py-6 text-center">
              Seleccioná una sucursal destino.
            </p>
          ) : null}

          {!loading &&
          !error &&
          sucDestinoId !== null &&
          items.length === 0 ? (
            <p className="text-sm text-foreground py-6 text-center">
              No hay transferencias abiertas hacia esta sucursal.
            </p>
          ) : null}

          {!loading && !error && items.length > 0 ? (
            <Table
              variant="compact"
              className="tabla-recepcion-pedido"
              scrollX={false}
            >
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TablaControlItemHead className="w-[8%] min-w-12" />
                  <TableHead className="w-[26%]">COD. TIENDA</TableHead>
                  <TableHead className="w-[50%]">DESCRIPCIÓN</TableHead>
                  <TableHead className="w-[16%] text-center">
                    CANTIDAD A TRANSFERIR
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const ok = okPorCodTienda[item.codTienda] === true;
                  return (
                    <TableRow
                      key={item.codTienda}
                      className={cn(
                        "transition-colors duration-100",
                        ok ? "recepcion-fila-verificada" : "recepcion-fila-activa"
                      )}
                    >
                      <TablaControlItemCelda
                        verificado={ok}
                        placeholderTitle="Verificá con OK: copia el Cod. Tienda y marca el ítem."
                        className="w-[8%] min-w-12"
                      />
                      <TableCell className="celda-datos w-[26%]">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleOkItem(item.codTienda)}
                            disabled={isPending}
                            className={BOTON_COPIAR_CELDA_CLASS}
                            aria-label={
                              ok
                                ? "Desmarcar ítem"
                                : "OK, copiar código de tienda"
                            }
                            title={
                              ok ? "Desmarcar ítem" : "OK — copiar Cod. Tienda"
                            }
                          >
                            <Check
                              className={TABLE_ROW_ACTION_ICON_CLASS}
                              aria-hidden
                            />
                          </Button>
                          <span className="tabular-nums">{item.codTienda}</span>
                        </div>
                      </TableCell>
                      <TableCell
                        className="celda-datos min-w-0 w-[50%] truncate"
                        title={item.descripcionTienda}
                      >
                        {item.descripcionTienda}
                      </TableCell>
                      <TableCell className="celda-datos w-[16%]">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="tabular-nums">
                            {fmtCantidad(item.cantidad)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              void copiarDatoTransf(
                                formatCantidadInputValor(item.cantidad),
                                "Cant. Copiada"
                              )
                            }
                            disabled={isPending}
                            className={BOTON_COPIAR_CELDA_CLASS}
                            aria-label="Copiar cantidad"
                            title="Copiar cantidad"
                          >
                            <Copy
                              className={TABLE_ROW_ACTION_ICON_CLASS}
                              aria-hidden
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </div>
      </AppModal>
    </Dialog>
  );
}
