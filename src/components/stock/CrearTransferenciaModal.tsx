"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AppModal from "@/components/shared/AppModal";
import PaginacionClient from "@/components/shared/PaginacionClient";
import FiltrosTransfDepositos, {
  type FiltrosTransfDepositosCambio,
} from "@/components/stock/FiltrosTransfDepositos";
import TablaTransfDepositos, {
  type TablaTransfDepositosHandle,
} from "@/components/stock/TablaTransfDepositos";
import {
  actualizarTransferenciaApi,
  crearTransferenciaApi,
  listarCatalogoTransfDepositosApi,
  pedirRefrescoNotificaciones,
} from "@/lib/stockTransferenciasClient";
import { parTransfIncluyeSucursalUsuario } from "@/lib/transfDepositosControl";
import type { BorradorTransfDepositos } from "@/lib/transfDepositosControl";
import {
  TRANSF_DEPOSITOS_DATA_VACIO,
  type SucursalTransf,
  type TransfDepositosData,
} from "@/lib/transfDepositosTypes";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: "crear" | "editar";
  transferenciaId?: string;
  origenInicial?: SucursalTransf | null;
  destinoInicial?: SucursalTransf | null;
  cantidadesIniciales?: BorradorTransfDepositos;
  onGuardada?: () => void;
}

/**
 * Catálogo + cantidades de Trans. Depósitos. Crear o editar una versión abierta.
 */
export default function CrearTransferenciaModal({
  open,
  onOpenChange,
  modo,
  transferenciaId,
  origenInicial = null,
  destinoInicial = null,
  cantidadesIniciales,
  onGuardada,
}: Props) {
  const tablaRef = useRef<TablaTransfDepositosHandle>(null);
  const [origen, setOrigen] = useState<SucursalTransf | null>(origenInicial);
  const [destino, setDestino] = useState<SucursalTransf | null>(destinoInicial);
  const [q, setQ] = useState("");
  const [marca, setMarca] = useState("");
  const [rubro, setRubro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState<TransfDepositosData>(TRANSF_DEPOSITOS_DATA_VACIO);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      const usuario = leerUsuarioSesion();
      if (modo === "editar") {
        setOrigen(origenInicial);
        setDestino(destinoInicial);
      } else {
        setOrigen(origenInicial ?? usuario?.sucursalPorDefecto ?? null);
        setDestino(destinoInicial);
      }
      setQ("");
      setMarca("");
      setRubro("");
      setPagina(1);
      setData(TRANSF_DEPOSITOS_DATA_VACIO);
    });
  }, [open, modo, origenInicial, destinoInicial]);

  useEffect(() => {
    if (!open || !origen) {
      return;
    }
    let cancelado = false;
    void (async () => {
      const res = await listarCatalogoTransfDepositosApi({
        origen,
        destino,
        q,
        marca,
        rubro,
        pagina,
      });
      if (cancelado) return;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setData(res.data);
    })();
    return () => {
      cancelado = true;
    };
  }, [open, origen, destino, q, marca, rubro, pagina]);

  const onCambiarFiltros = useCallback((next: FiltrosTransfDepositosCambio) => {
    setOrigen(next.origen);
    setDestino(next.destino);
    setQ(next.q);
    setMarca(next.marca);
    setRubro(next.rubro);
    setPagina(1);
  }, []);

  function guardar() {
    const usuario = leerUsuarioSesion();
    if (!usuario) {
      toast.error("Elegí un usuario.");
      return;
    }
    if (!origen) {
      toast.error("Elegí sucursal origen.");
      return;
    }
    if (!destino) {
      toast.error("Elegí origen y destino distintos.");
      return;
    }
    if (
      !parTransfIncluyeSucursalUsuario(
        origen,
        destino,
        usuario.sucursalPorDefecto
      )
    ) {
      toast.error("Origen o destino debe ser tu sucursal.");
      return;
    }
    const items = tablaRef.current?.getItemsConCantidad() ?? [];
    if (items.length === 0) {
      toast.error("Cargá al menos una cantidad.");
      return;
    }
    const payload = {
      origenCodigo: origen,
      destinoCodigo: destino,
      personalId: usuario.idPersonal,
      items: items.map((item) => ({
        codItem: item.codTienda,
        cantidad: item.cantidad,
      })),
    };
    startTransition(async () => {
      const res =
        modo === "editar" && transferenciaId
          ? await actualizarTransferenciaApi(transferenciaId, payload)
          : await crearTransferenciaApi(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (modo === "crear") {
        tablaRef.current?.clearCantidades();
      }
      pedirRefrescoNotificaciones();
      onGuardada?.();
      onOpenChange(false);
      if (modo === "editar") {
        toast.success(`Transferencia N° ${res.data.numero} actualizada.`);
        return;
      }
      const creada = res.data as { numero: string; confirmaNombre: string };
      toast.success(`Transferencia N° ${creada.numero} enviada.`, {
        description: `Queda pendiente hasta que ${creada.confirmaNombre} la acepte.`,
      });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title={modo === "editar" ? "EDITAR TRANSFERENCIA" : "CREAR TRANSFERENCIA"}
        scrollBody={false}
        size="xl"
        className="max-w-[min(96rem,calc(100%-2rem))] h-[95vh] max-h-[95vh]"
        bodyShellClassName="p-0"
        padding="sm"
        headerClassName="pt-3 pb-3"
        footerClassName="py-3"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden py-2.5"
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
            <Button type="button" onClick={guardar} disabled={isPending}>
              {modo === "editar" ? "Guardar Cambios" : "Crear Transferencia"}
            </Button>
          </>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <FiltrosTransfDepositos
            data={data}
            origenActual={origen}
            destinoActual={destino}
            qActual={q}
            marcaActual={marca}
            rubroActual={rubro}
            onCambiar={onCambiarFiltros}
            parFijo={modo === "editar"}
          />
          <div className="contenedor-tabla-gestion no-scroll-x min-h-0 flex-1">
            <TablaTransfDepositos
              key={`${modo}:${transferenciaId ?? "nueva"}:${origen ?? ""}:${destino ?? ""}`}
              ref={tablaRef}
              data={data}
              origen={origen}
              destino={destino}
              persistirBorrador={modo === "crear"}
              cantidadesIniciales={
                modo === "editar" ? cantidadesIniciales : undefined
              }
            />
          </div>
          {origen && data.totalPaginas > 1 ? (
            <div className="flex shrink-0 justify-end">
              <PaginacionClient
                paginaActual={pagina}
                totalPaginas={data.totalPaginas}
                onPaginaChange={setPagina}
              />
            </div>
          ) : null}
        </div>
      </AppModal>
    </Dialog>
  );
}
