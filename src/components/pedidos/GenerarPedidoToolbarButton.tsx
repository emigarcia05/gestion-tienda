"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalFeedbackRegion from "@/components/shared/ModalFeedbackRegion";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  TIPOS_PEDIDO,
  type SucursalPedido,
  type TipoPedido,
} from "@/lib/pedidos";
import {
  comprobarItemsParaGenerarPedidoAction,
  generarPdfEnviarPedidoAction,
  getReposicionProveedorPrioritarioParaModalAction,
  getSobreStockReposicionParaModalAction,
  listarProveedoresConPedidoActivoAction,
} from "@/actions/pedidos";
import { descargarPdfBase64 } from "@/lib/descargarPdfBase64";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
import SobreStockReposicionAdvertenciaModal from "@/components/shared/SobreStockReposicionAdvertenciaModal";
import ReposicionProveedorPrioritarioModal, {
  type ReposicionProveedorPrioritarioSeleccion,
} from "@/components/shared/ReposicionProveedorPrioritarioModal";
import type { SobreStockReposicionItem } from "@/services/sobreStock.service";
import type { ReposicionProveedorPrioritarioItem } from "@/services/pedidosEnvio.service";

const PREFIX_SOBRESTOCK = "SOBRESTOCK_REQUIERE_CONFIRMACION:";
const PREFIX_REPOSICION_PRIORITARIO = "REPOSICION_PROVEEDOR_PRIORITARIO_REQUIERE_CONFIRMACION:";

const OPCIONES_TIPO: { value: TipoPedido; label: string }[] = [
  { value: "TINTOMETRICO", label: "TINTOMÉTRICO" },
  { value: "URGENTE", label: "URGENTE" },
  { value: "REPOSICION", label: "REPOSICIÓN" },
  { value: "A FÁBRICA", label: "A FÁBRICA" },
];

const BOTON_CUADRADO_CLASS =
  "h-16 w-[6.5rem] shrink-0 flex-col gap-1 whitespace-normal border border-primary px-2 py-1.5";

function tiposCatalogoParaModulo(modulo: ModuloGenerarPedidoOrigen): TipoPedido[] {
  if (modulo === "a-fabrica") return ["A FÁBRICA"];
  return ["TINTOMETRICO", "URGENTE", "REPOSICION"];
}

function parseTipoPedido(raw: string): TipoPedido | null {
  return (TIPOS_PEDIDO as readonly string[]).includes(raw) ? (raw as TipoPedido) : null;
}

function etiquetaProveedor(p: ProveedorGenerarPedidoOpcion): string {
  const pref = p.prefijo.trim();
  const nom = p.nombre.trim();
  return (pref ? `[${pref}] ${nom}` : nom).toUpperCase();
}

function etiquetaTipoPedido(tipo: TipoPedido): string {
  return OPCIONES_TIPO.find((o) => o.value === tipo)?.label ?? tipo;
}

export type ModuloGenerarPedidoOrigen =
  | "enviar"
  | "urgente"
  | "tintometrico"
  | "reposicion"
  | "a-fabrica";

export interface ProveedorGenerarPedidoOpcion {
  id: string;
  nombre: string;
  prefijo: string;
  tipos: TipoPedido[];
}

interface Props {
  proveedores: { id: string; nombre: string; prefijo: string }[];
  defaultSucursal: SucursalPedido | "";
  defaultProveedor: string;
  defaultTipos: TipoPedido[];
  modulo: ModuloGenerarPedidoOrigen;
  /** Texto del botón que abre el modal (title case). */
  triggerLabel?: string;
  triggerClassName?: string;
  triggerSize?: ComponentProps<typeof Button>["size"];
  /** Tras generar con éxito (antes del refresh de Next). Útil para limpiar estado local en Pedido Urgente. */
  onGeneradoExito?: () => void;
}

export default function GenerarPedidoToolbarButton({
  proveedores: _proveedores,
  defaultSucursal: _defaultSucursal,
  defaultProveedor,
  defaultTipos: _defaultTipos,
  modulo,
  triggerLabel = "Generar Pedido",
  triggerClassName,
  triggerSize = "sm",
  onGeneradoExito,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sucursal, setSucursal] = useState<SucursalPedido | "">("");
  const [proveedor, setProveedor] = useState("");
  const [tipos, setTipos] = useState<TipoPedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [sobreStockOpen, setSobreStockOpen] = useState(false);
  const [sobreStockItems, setSobreStockItems] = useState<
    SobreStockReposicionItem[]
  >([]);
  const [reposicionPrioritarioOpen, setReposicionPrioritarioOpen] = useState(false);
  const [reposicionPrioritarioItems, setReposicionPrioritarioItems] = useState<
    ReposicionProveedorPrioritarioItem[]
  >([]);
  const [reposicionPrioritarioSeleccion, setReposicionPrioritarioSeleccion] =
    useState<ReposicionProveedorPrioritarioSeleccion[] | null>(null);
  const [hayItems, setHayItems] = useState<boolean | null>(null);
  const [verificandoItems, setVerificandoItems] = useState(false);
  const [errorVerificacion, setErrorVerificacion] = useState<string | null>(null);
  const [proveedoresActivos, setProveedoresActivos] = useState<ProveedorGenerarPedidoOpcion[]>([]);
  const [cargandoProveedores, setCargandoProveedores] = useState(false);
  const verificarSeqRef = useRef(0);
  const proveedoresSeqRef = useRef(0);
  const proveedorRef = useRef(proveedor);
  proveedorRef.current = proveedor;

  const aplicarDefaults = useCallback(() => {
    const sucUsuario = leerUsuarioSesion()?.sucursalPorDefecto ?? "";
    setSucursal(sucUsuario === "guaymallen" || sucUsuario === "maipu" ? sucUsuario : "");
    setProveedor(defaultProveedor.trim());
    setTipos([]);
  }, [defaultProveedor]);

  useEffect(() => {
    if (open) aplicarDefaults();
  }, [open, aplicarDefaults]);

  useEffect(() => {
    if (!open) {
      setHayItems(null);
      setVerificandoItems(false);
      setErrorVerificacion(null);
      setSobreStockOpen(false);
      setSobreStockItems([]);
      setReposicionPrioritarioOpen(false);
      setReposicionPrioritarioItems([]);
      setReposicionPrioritarioSeleccion(null);
      setProveedoresActivos([]);
      setCargandoProveedores(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !sucursal) {
      setProveedoresActivos([]);
      return;
    }

    const seq = ++proveedoresSeqRef.current;
    setCargandoProveedores(true);
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const res = await listarProveedoresConPedidoActivoAction({
          sucursal,
          tipos: tiposCatalogoParaModulo(modulo),
          soloNoFabrica: modulo === "reposicion",
        });
        if (seq !== proveedoresSeqRef.current) return;
        setCargandoProveedores(false);
        if (!res.ok) {
          setProveedoresActivos([]);
          return;
        }
        const lista: ProveedorGenerarPedidoOpcion[] = res.data.proveedores.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          prefijo: p.prefijo,
          tipos: p.tipos
            .map(parseTipoPedido)
            .filter((t): t is TipoPedido => t != null),
        }));
        setProveedoresActivos(lista);
        const pid = proveedorRef.current.trim();
        const nextId =
          pid && lista.some((p) => p.id === pid)
            ? pid
            : lista.length === 1
              ? lista[0]!.id
              : "";
        const elegido = lista.find((p) => p.id === nextId);
        setProveedor(nextId);
        setTipos(
          tiposCatalogoParaModulo(modulo).filter((t) => elegido?.tipos.includes(t))
        );
      })();
    }, 280);

    return () => window.clearTimeout(timeoutId);
  }, [open, sucursal, modulo]);

  const tiposDisponibles = useMemo(() => {
    const catalogo = tiposCatalogoParaModulo(modulo);
    const pid = proveedor.trim();
    const elegido = proveedoresActivos.find((x) => x.id === pid);
    const crudos = elegido
      ? elegido.tipos
      : [...new Set(proveedoresActivos.flatMap((x) => x.tipos))];
    return catalogo.filter((t) => crudos.includes(t));
  }, [modulo, proveedor, proveedoresActivos]);

  const filtrosCompletos =
    !!sucursal && !!proveedor.trim() && tipos.length > 0;

  const proveedorPedidoEtiqueta = useMemo(() => {
    const pid = proveedor.trim();
    const p = proveedoresActivos.find((x) => x.id === pid);
    if (!p) return "—";
    return etiquetaProveedor(p);
  }, [proveedoresActivos, proveedor]);

  function seleccionarProveedor(id: string) {
    setProveedor(id);
    const p = proveedoresActivos.find((x) => x.id === id);
    const next = tiposCatalogoParaModulo(modulo).filter((t) => p?.tipos.includes(t));
    setTipos(next);
  }

  function toggleTipo(tipo: TipoPedido) {
    if (!tiposDisponibles.includes(tipo)) return;
    setTipos((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  }

  useEffect(() => {
    if (!open || !filtrosCompletos || !sucursal) {
      setHayItems(null);
      setVerificandoItems(false);
      setErrorVerificacion(null);
      return;
    }

    setVerificandoItems(true);
    setHayItems(null);
    setErrorVerificacion(null);
    const seq = ++verificarSeqRef.current;
    const proveedorId = proveedor.trim();
    const tiposSnapshot = [...tipos];

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const res = await comprobarItemsParaGenerarPedidoAction({
          proveedorId,
          sucursal,
          tipos: tiposSnapshot,
        });
        if (seq !== verificarSeqRef.current) return;
        setVerificandoItems(false);
        if (!res.ok) {
          setErrorVerificacion(res.error);
          setHayItems(null);
          return;
        }
        setHayItems(res.data.hayItems);
      })();
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [open, filtrosCompletos, sucursal, proveedor, tipos]);

  const faltantes: string[] = [];
  if (!proveedor.trim()) faltantes.push("PROVEEDOR");
  if (tipos.length === 0) faltantes.push("TIPO DE PEDIDO");

  const mensajeFaltantes = !sucursal
    ? "SELECCIONÁ UN USUARIO EN EL SLIDENAV."
    : faltantes.length > 0
      ? `FALTA SELECCIONAR: ${faltantes.join(", ")}.`
      : null;

  const puedeGenerar =
    filtrosCompletos && hayItems === true && !verificandoItems && !errorVerificacion;

  /** Tras `SOBRESTOCK_REQUIERE_CONFIRMACION` del servidor, carga ítems y abre el modal. */
  async function abrirModalSobrestockDesdeServidor(): Promise<void> {
    const proveedorId = proveedor.trim();
    if (!sucursal || !proveedorId || tipos.length === 0) return;

    const res = await getSobreStockReposicionParaModalAction({
      proveedorId,
      sucursal,
      tipos: [...tipos],
      forzarIdsReposicionAlProveedor:
        reposicionPrioritarioSeleccion?.map((s) => s.idItemPedidoEnvio) ?? undefined,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (!res.data.tieneSobreStock) {
      toast.error(
        "No se pudo mostrar el detalle de sobrestock. Volvé a intentar generar el pedido."
      );
      return;
    }
    setSobreStockItems(res.data.items);
    setSobreStockOpen(true);
  }

  async function abrirModalReposicionPrioritarioDesdeServidor(): Promise<void> {
    const proveedorId = proveedor.trim();
    if (!sucursal || !proveedorId) return;

    const res = await getReposicionProveedorPrioritarioParaModalAction({
      proveedorId,
      sucursal,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (!res.data.tieneItems) {
      toast.error(
        "No se pudo mostrar el detalle de reposición. Volvé a intentar generar el pedido."
      );
      return;
    }
    setReposicionPrioritarioItems(res.data.items);
    setReposicionPrioritarioOpen(true);
  }

  function finalizarGeneracionExitosa(data: {
    pdfBase64: string;
    filename: string;
    sentViaWhatsApp: boolean;
  }) {
    onGeneradoExito?.();
    router.refresh();
    setReposicionPrioritarioSeleccion(null);
    setReposicionPrioritarioOpen(false);
    setSobreStockOpen(false);

    if (data.sentViaWhatsApp) {
      toast.success("Pedido generado y enviado al proveedor.");
      setOpen(false);
      return;
    }

    descargarPdfBase64(data.pdfBase64, data.filename);
    toast.success(`PDF generado: ${data.filename}`);
    setOpen(false);
  }

  async function ejecutarGenerar(opts?: {
    confirmarReposicionProveedorPrioritario?: boolean;
    itemsReposicionProveedorPrioritario?: ReposicionProveedorPrioritarioSeleccion[];
    confirmarSobreStock?: boolean;
    ajustesSobreStock?: Array<{ idItemPedidoEnvio: string; cantPedir: number }>;
  }) {
    if (!sucursal) return;

    const result = await generarPdfEnviarPedidoAction({
      proveedorId: proveedor.trim(),
      sucursal,
      tipos,
      confirmarReposicionProveedorPrioritario:
        opts?.confirmarReposicionProveedorPrioritario ??
        reposicionPrioritarioSeleccion !== null,
      itemsReposicionProveedorPrioritario:
        opts?.itemsReposicionProveedorPrioritario ?? reposicionPrioritarioSeleccion ?? undefined,
      confirmarSobreStock: opts?.confirmarSobreStock,
      ajustesSobreStock: opts?.ajustesSobreStock,
    });

    if (!result.ok) {
      if (result.error.startsWith(PREFIX_REPOSICION_PRIORITARIO)) {
        await abrirModalReposicionPrioritarioDesdeServidor();
        return;
      }
      if (result.error.startsWith(PREFIX_SOBRESTOCK)) {
        await abrirModalSobrestockDesdeServidor();
        return;
      }
      toast.error(result.error);
      return;
    }

    finalizarGeneracionExitosa(result.data!);
  }

  async function handleGenerar() {
    if (!puedeGenerar || !sucursal || hayItems !== true) {
      toast.error(
        "Completá los filtros y asegurate de que haya ítems para generar el pedido."
      );
      return;
    }
    setLoading(true);
    try {
      await ejecutarGenerar();
    } finally {
      setLoading(false);
    }
  }

  async function handleReposicionPrioritarioConfirmar(
    seleccionados: ReposicionProveedorPrioritarioSeleccion[]
  ) {
    setReposicionPrioritarioSeleccion(seleccionados);
    setLoading(true);
    try {
      await ejecutarGenerar({
        confirmarReposicionProveedorPrioritario: true,
        itemsReposicionProveedorPrioritario: seleccionados,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePedirAlProveedorIgual(
    ajustesSobreStock: Array<{ idItemPedidoEnvio: string; cantPedir: number }>
  ) {
    if (!sucursal) return;
    setLoading(true);
    try {
      await ejecutarGenerar({
        confirmarSobreStock: true,
        ajustesSobreStock,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        size={triggerSize}
        onClick={() => setOpen(true)}
        className={cn("gap-2", triggerClassName)}
        aria-label={triggerLabel}
      >
        <Send className="h-4 w-4" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <AppModal
          title="Generar Pedido"
          size="lg"
          padding="sm"
          scrollBody={false}
          headerClassName="pt-4 pb-3"
          footerClassName="py-3"
          actions={
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setSobreStockOpen(false);
                  setSobreStockItems([]);
                }}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={handleGenerar}
                disabled={!puedeGenerar || loading || verificandoItems}
                className="gap-2"
                aria-label="Generar Pedido"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Generar Pedido
              </Button>
            </div>
          }
        >
          <div className="flex w-full min-w-0 flex-col gap-4">
            {sucursal ? (
              <>
                <div className="flex w-full min-w-0 flex-col gap-2">
                  <ModalMicroLabel>PROVEEDORES</ModalMicroLabel>
                  {cargandoProveedores ? (
                    <div className="flex min-h-16 items-center justify-center gap-2">
                      <Loader2
                        className="h-5 w-5 shrink-0 animate-spin text-muted-foreground"
                        aria-hidden
                      />
                      <p className="text-sm leading-snug text-muted-foreground uppercase tracking-wide">
                        CARGANDO PROVEEDORES…
                      </p>
                    </div>
                  ) : proveedoresActivos.length === 0 ? (
                    <p
                      className="text-sm leading-snug text-muted-foreground uppercase tracking-wide"
                      role="status"
                    >
                      SIN PROVEEDORES CON PEDIDO
                    </p>
                  ) : (
                    <div
                      role="radiogroup"
                      aria-label="Proveedores"
                      className="flex flex-wrap justify-center gap-2"
                    >
                      {proveedoresActivos.map((p) => {
                        const seleccionado = p.id === proveedor.trim();
                        return (
                          <Button
                            key={p.id}
                            type="button"
                            role="radio"
                            aria-checked={seleccionado}
                            variant={seleccionado ? "default" : "outline"}
                            disabled={loading}
                            className={BOTON_CUADRADO_CLASS}
                            onClick={() => seleccionarProveedor(p.id)}
                          >
                            <span className="line-clamp-3 text-center text-[0.65rem] font-semibold uppercase leading-tight tracking-wide">
                              {etiquetaProveedor(p)}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex w-full min-w-0 flex-col gap-2">
                  <ModalMicroLabel>TIPO DE PEDIDO</ModalMicroLabel>
                  {tiposDisponibles.length === 0 ? (
                    <p
                      className="text-sm leading-snug text-muted-foreground uppercase tracking-wide"
                      role="status"
                    >
                      SIN TIPOS CON CANTIDAD A PEDIR
                    </p>
                  ) : (
                    <div
                      role="group"
                      aria-label="Tipo de pedido (selección múltiple)"
                      className="flex flex-wrap justify-center gap-2"
                    >
                      {tiposDisponibles.map((tipo) => {
                        const seleccionado = tipos.includes(tipo);
                        return (
                          <Button
                            key={tipo}
                            type="button"
                            aria-pressed={seleccionado}
                            variant={seleccionado ? "default" : "outline"}
                            disabled={loading || !proveedor.trim()}
                            className={BOTON_CUADRADO_CLASS}
                            onClick={() => toggleTipo(tipo)}
                          >
                            <span className="line-clamp-2 text-center text-[0.65rem] font-semibold uppercase leading-tight tracking-wide">
                              {etiquetaTipoPedido(tipo)}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}

            <ModalFeedbackRegion>
              {mensajeFaltantes ? (
                <div className="flex max-w-full flex-col items-center justify-center gap-2">
                  <AlertCircle
                    className="h-5 w-5 shrink-0 text-destructive"
                    aria-hidden
                  />
                  <p className="text-sm leading-snug text-foreground">
                    {mensajeFaltantes}
                  </p>
                </div>
              ) : errorVerificacion ? (
                <div className="flex max-w-full flex-col items-center justify-center gap-2">
                  <AlertCircle
                    className="h-5 w-5 shrink-0 text-destructive"
                    aria-hidden
                  />
                  <p className="text-sm leading-snug text-destructive">
                    {errorVerificacion}
                  </p>
                </div>
              ) : verificandoItems ? (
                <div className="flex max-w-full flex-col items-center justify-center gap-2">
                  <Loader2
                    className="h-5 w-5 shrink-0 animate-spin text-muted-foreground"
                    aria-hidden
                  />
                  <p className="text-sm leading-snug text-muted-foreground uppercase tracking-wide">
                    COMPROBANDO ÍTEMS…
                  </p>
                </div>
              ) : filtrosCompletos && hayItems === false ? (
                <div className="flex max-w-full flex-col items-center justify-center gap-2">
                  <AlertCircle
                    className="h-5 w-5 shrink-0 text-destructive"
                    aria-hidden
                  />
                  <p className="text-sm leading-snug text-muted-foreground uppercase tracking-wide">
                    NO HAY ÍTEMS PARA ESTA COMBINACIÓN DE FILTROS.
                  </p>
                </div>
              ) : filtrosCompletos && hayItems === true ? (
                <div className="flex max-w-full flex-col items-center justify-center gap-2">
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-primary"
                    aria-hidden
                  />
                  <p className="text-sm font-medium leading-snug text-foreground uppercase tracking-wide">
                    LISTO PARA GENERAR EL PEDIDO.
                  </p>
                </div>
              ) : null}
            </ModalFeedbackRegion>
          </div>
        </AppModal>
      </Dialog>

      <SobreStockReposicionAdvertenciaModal
        open={sobreStockOpen}
        onOpenChange={(v) => setSobreStockOpen(v)}
        items={sobreStockItems}
        pending={loading}
        onPedirAlProveedorIgual={handlePedirAlProveedorIgual}
      />

      <ReposicionProveedorPrioritarioModal
        open={reposicionPrioritarioOpen}
        onOpenChange={(v) => setReposicionPrioritarioOpen(v)}
        items={reposicionPrioritarioItems}
        proveedorPedidoEtiqueta={proveedorPedidoEtiqueta}
        pending={loading}
        onConfirmar={handleReposicionPrioritarioConfirmar}
      />
    </>
  );
}
