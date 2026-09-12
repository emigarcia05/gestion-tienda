"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Landmark,
  Megaphone,
  Receipt,
  ShieldCheck,
  Store,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AppModal from "@/components/shared/AppModal";
import TransferenciaPendienteAvisoModal from "@/components/stock/TransferenciaPendienteAvisoModal";
import { activarModoEditor } from "@/actions/sesion";
import { listUsuariosParaInicioSesionAction } from "@/actions/globalPersonal";
import {
  EVENTO_AVISO_TRANSF_PENDIENTE,
  fetchIndicadorSlidenav,
} from "@/lib/indicadorSlidenav";
import {
  areaLabelMayusculas,
  getMainAppAreaById,
  getMainAppAreaIdFromPathname,
  type MainAppAreaId,
} from "@/lib/main-app-areas";
import type { GlobalPersonalItem } from "@/services/globalPersonal.service";
import {
  guardarUsuarioSesion,
  hayAvisoTransfPendiente,
  limpiarAvisoTransfPendiente,
  marcarAvisoTransfPendiente,
  leerUsuarioSesion,
  usuarioSesionDesdeItem,
  type UsuarioSesion,
} from "@/lib/usuarioSesion";
import { type SucursalPreferida } from "@/lib/sucursalPreferida";
import { hrefAbrirGenerarTransfDepositos } from "@/lib/transfDepositosControl";
import {
  puedeCambiarModulo,
  primerModuloPermitido,
  etiquetaSucursalPorDefecto,
} from "@/lib/usuarios";
import type { Rol } from "@/lib/permisos";
import { cn } from "@/lib/utils";

interface Props {
  /** Rol de sesión (`editor` = ya desbloqueó Administración en esta sesión). */
  rolActual: Rol;
}

const ICONO_MODULO: Record<MainAppAreaId, LucideIcon> = {
  "gestion-productos": Store,
  finanzas: Landmark,
  marketing: Megaphone,
  facturacion: Receipt,
};

function nombreUsuarioLabel(nombre: string): string {
  return nombre.toLocaleUpperCase("es-AR");
}

/**
 * Pie de slidenav: fila de usuario (ícono módulo si puede cambiar + nombre).
 * Vive dentro del dock de sesión (`sidebar-user-switcher-surface` en `Sidebar`).
 * Primera visita: modal **Elegir Usuario**.
 * La clave se solicita solo al entrar a un área que la requiere (Administración).
 */
export default function SidebarAreaSwitcher({ rolActual }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [forceChoose, setForceChoose] = useState(false);
  const [usuarioOpen, setUsuarioOpen] = useState(false);
  const [moduloOpen, setModuloOpen] = useState(false);
  const [claveOpen, setClaveOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<GlobalPersonalItem[]>([]);
  const [usuariosError, setUsuariosError] = useState("");
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [sucursalSeleccionadaUsuario, setSucursalSeleccionadaUsuario] =
    useState<SucursalPreferida | null>(null);
  const [usuarioSesion, setUsuarioSesion] = useState<UsuarioSesion | null>(null);
  const [clave, setClave] = useState("");
  const [mostrarClave, setMostrarClave] = useState(false);
  const [error, setError] = useState("");
  const [pendingUsuario, setPendingUsuario] = useState<UsuarioSesion | null>(null);
  const [pendingAreaId, setPendingAreaId] = useState<MainAppAreaId | null>(null);
  const [pending, startTransition] = useTransition();
  const [transfPendienteOpen, setTransfPendienteOpen] = useState(false);
  const [avisoTransfTick, setAvisoTransfTick] = useState(0);

  const currentId = getMainAppAreaIdFromPathname(pathname);
  const puedeCambiar = usuarioSesion
    ? puedeCambiarModulo(usuarioSesion.modulosPermitidos)
    : false;

  useEffect(() => {
    const guardado = leerUsuarioSesion();
    queueMicrotask(() => {
      setUsuarioSesion(guardado);
      if (!guardado) {
        setForceChoose(true);
        setUsuarioOpen(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!usuarioOpen) return;
    let cancelled = false;
    queueMicrotask(() => {
      setCargandoUsuarios(true);
      setUsuariosError("");
    });
    void listUsuariosParaInicioSesionAction().then((res) => {
      if (cancelled) return;
      setCargandoUsuarios(false);
      if (!res.ok) {
        setUsuarios([]);
        setUsuariosError(res.error);
        return;
      }
      setUsuarios(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [usuarioOpen]);

  useEffect(() => {
    function onAvisoListo() {
      setAvisoTransfTick((n) => n + 1);
    }
    window.addEventListener(EVENTO_AVISO_TRANSF_PENDIENTE, onAvisoListo);
    return () => {
      window.removeEventListener(EVENTO_AVISO_TRANSF_PENDIENTE, onAvisoListo);
    };
  }, []);

  useEffect(() => {
    if (usuarioOpen || claveOpen || moduloOpen) return;
    if (!hayAvisoTransfPendiente()) return;
    const id = window.setTimeout(() => {
      setTransfPendienteOpen(true);
    }, 450);
    return () => window.clearTimeout(id);
  }, [usuarioOpen, claveOpen, moduloOpen, avisoTransfTick]);

  function persistirYNavegar(
    usuario: UsuarioSesion,
    areaId: MainAppAreaId,
    avisarTransfPendiente = false
  ) {
    guardarUsuarioSesion(usuario);
    setUsuarioSesion(usuario);
    setForceChoose(false);
    setUsuarioOpen(false);
    setModuloOpen(false);
    setClaveOpen(false);
    setPendingUsuario(null);
    setPendingAreaId(null);
    if (avisarTransfPendiente) {
      void consultarYAvisarTransfPendiente(usuario.sucursalPorDefecto);
    }
    if (getMainAppAreaIdFromPathname(pathname) !== areaId) {
      router.push(getMainAppAreaById(areaId).href);
    }
  }

  async function consultarYAvisarTransfPendiente(sucursal: SucursalPreferida) {
    const data = await fetchIndicadorSlidenav(sucursal, "transf");
    if (!data?.hayTransfOrigen) return;
    marcarAvisoTransfPendiente();
    window.dispatchEvent(new Event(EVENTO_AVISO_TRANSF_PENDIENTE));
  }

  function pedirClave(usuario: UsuarioSesion, areaId: MainAppAreaId) {
    setPendingUsuario(usuario);
    setPendingAreaId(areaId);
    setUsuarioOpen(false);
    setModuloOpen(false);
    setClave("");
    setError("");
    setMostrarClave(false);
    setClaveOpen(true);
  }

  function aplicarUsuario(item: GlobalPersonalItem) {
    const usuario = usuarioSesionDesdeItem(item);
    if (!usuario) return;
    const destino = primerModuloPermitido(usuario.modulosPermitidos);
    if (!destino) return;
    const areaDestino = getMainAppAreaById(destino);
    if (areaDestino.requierePassword && rolActual !== "editor") {
      pedirClave(usuario, destino);
      return;
    }
    persistirYNavegar(usuario, destino, true);
  }

  function aplicarModulo(usuario: UsuarioSesion, areaId: MainAppAreaId) {
    if (areaId === currentId && !forceChoose) {
      setModuloOpen(false);
      return;
    }
    const area = getMainAppAreaById(areaId);
    if (area.requierePassword && rolActual !== "editor") {
      pedirClave(usuario, areaId);
      return;
    }
    persistirYNavegar(usuario, areaId);
  }

  function handleActivarYNavegar() {
    if (!pendingUsuario || !pendingAreaId) return;
    setError("");
    startTransition(async () => {
      const res = await activarModoEditor(clave);
      if (!res.ok) {
        setError(res.error ?? "Error desconocido.");
        return;
      }
      persistirYNavegar(pendingUsuario, pendingAreaId, true);
      router.refresh();
    });
  }

  function handleUsuarioOpenChange(open: boolean) {
    if (!open && forceChoose) {
      setUsuarioOpen(true);
      return;
    }
    if (open) {
      setSucursalSeleccionadaUsuario(null);
    }
    setUsuarioOpen(open);
  }

  function handleClaveOpenChange(open: boolean) {
    setClaveOpen(open);
    if (!open) {
      setPendingUsuario(null);
      setPendingAreaId(null);
      if (forceChoose) {
        setUsuarioOpen(true);
      }
    }
  }

  function handleCancelarClave() {
    setClaveOpen(false);
    setPendingUsuario(null);
    setPendingAreaId(null);
    if (forceChoose) {
      setUsuarioOpen(true);
    }
  }

  const labelUsuario = usuarioSesion
    ? nombreUsuarioLabel(usuarioSesion.nombrePersonal)
    : "USUARIO";
  const sucursalesUsuario = Array.from(
    new Set(
      usuarios
        .map((u) => u.sucursalPorDefecto)
        .filter((s): s is SucursalPreferida => s === "guaymallen" || s === "maipu")
    )
  );
  const usuariosSucursalSeleccionada =
    sucursalSeleccionadaUsuario == null
      ? []
      : usuarios.filter((u) => u.sucursalPorDefecto === sucursalSeleccionadaUsuario);
  const tituloElegirUsuario =
    sucursalSeleccionadaUsuario == null
      ? "Elegir Sucursal"
      : `Usuarios ${etiquetaSucursalPorDefecto(sucursalSeleccionadaUsuario)}`;

  const IconoModulo = ICONO_MODULO[currentId];

  function abrirCambiarModulo() {
    setModuloOpen(true);
  }

  function abrirCambiarUsuario() {
    setUsuariosError("");
    setUsuarioOpen(true);
  }

  function handleTransferirAhora() {
    limpiarAvisoTransfPendiente();
    setTransfPendienteOpen(false);
    const origen =
      usuarioSesion?.sucursalPorDefecto ?? sucursalSeleccionadaUsuario;
    router.push(hrefAbrirGenerarTransfDepositos(origen));
  }

  function handleAvisoTransfOpenChange(open: boolean) {
    setTransfPendienteOpen(open);
    if (!open) limpiarAvisoTransfPendiente();
  }

  return (
    <>
      {puedeCambiar ? (
        <div
          className={cn(
            "flex h-9 w-full items-center justify-center gap-1.5 rounded-md px-2",
            "text-sidebar-foreground"
          )}
        >
          <button
            type="button"
            onClick={abrirCambiarModulo}
            disabled={pending || forceChoose}
            aria-label="Cambiar Módulo"
            title="Cambiar Módulo"
            className={cn(
              "flex h-8 w-[15%] max-w-6 shrink-0 items-center justify-center rounded-md",
              "outline-none hover:bg-sidebar-accent/80",
              "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              pending && "cursor-not-allowed opacity-90"
            )}
          >
            <IconoModulo className="size-4 shrink-0" aria-hidden />
          </button>
          <button
            type="button"
            onClick={abrirCambiarUsuario}
            disabled={pending || forceChoose}
            aria-label="Cambiar Usuario"
            title="Cambiar Usuario"
            className={cn(
              "h-8 min-w-0 max-w-[85%] flex-1 truncate rounded-md px-2 text-center text-xs font-semibold tracking-wide",
              "outline-none hover:bg-sidebar-accent/80",
              "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              pending && "cursor-not-allowed opacity-90"
            )}
          >
            {labelUsuario}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={abrirCambiarUsuario}
          disabled={pending || forceChoose}
          aria-label="Cambiar Usuario"
          title="Cambiar Usuario"
          className={cn(
            "flex h-9 w-full items-center justify-center rounded-md px-2",
            "truncate text-center text-xs font-semibold tracking-wide",
            "text-sidebar-foreground",
            "outline-none hover:bg-sidebar-accent/80",
            "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            pending && "cursor-not-allowed opacity-90"
          )}
        >
          {labelUsuario}
        </button>
      )}

      <Dialog open={usuarioOpen} onOpenChange={handleUsuarioOpenChange}>
        <AppModal
          size="sm"
          title={tituloElegirUsuario}
          padding="sm"
          showCloseButton={!forceChoose}
          footerClassName={forceChoose ? "justify-center" : undefined}
          actions={
            forceChoose ? (
              <p className="w-full text-center text-sm text-muted-foreground">
                {sucursalSeleccionadaUsuario == null
                  ? "Tocá una sucursal para continuar"
                  : "Tocá un usuario para continuar"}
              </p>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setUsuarioOpen(false)}
                disabled={pending}
              >
                Cerrar
              </Button>
            )
          }
        >
          <div className="flex w-full min-w-0 flex-col gap-2">
            {cargandoUsuarios ? (
              <p className="text-sm text-foreground">Cargando…</p>
            ) : null}
            {usuariosError ? (
              <p className="text-sm text-destructive">{usuariosError}</p>
            ) : null}
            {!cargandoUsuarios && !usuariosError && usuarios.length === 0 ? (
              <p className="text-sm text-foreground">
                No hay usuarios configurados. Cargá sucursal y módulos en Usuarios.
              </p>
            ) : null}
            {!cargandoUsuarios &&
            !usuariosError &&
            usuarios.length > 0 &&
            sucursalSeleccionadaUsuario == null ? (
              <div
                className="flex max-h-[min(24rem,50vh)] w-full min-w-0 flex-col gap-2 overflow-y-auto"
                role="list"
                aria-label="Sucursales disponibles"
              >
                {sucursalesUsuario.map((sucursal) => (
                  <Button
                    key={sucursal}
                    type="button"
                    variant="outline"
                    role="listitem"
                    disabled={pending}
                    onClick={() => setSucursalSeleccionadaUsuario(sucursal)}
                    className={cn(
                      "h-auto w-full justify-start px-3 py-2.5 text-left",
                      "whitespace-normal"
                    )}
                  >
                    <span className="flex min-w-0 flex-col items-start gap-0.5">
                      <span className="w-full truncate text-sm font-semibold tracking-wide">
                        {etiquetaSucursalPorDefecto(sucursal)}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            ) : null}
            {!cargandoUsuarios &&
            !usuariosError &&
            usuarios.length > 0 &&
            sucursalSeleccionadaUsuario != null ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setSucursalSeleccionadaUsuario(null)}
                  className="justify-start"
                >
                  Volver a sucursales
                </Button>
                <div
                  className="flex max-h-[min(24rem,50vh)] w-full min-w-0 flex-col gap-2 overflow-y-auto"
                  role="list"
                  aria-label="Usuarios disponibles"
                >
                  {usuariosSucursalSeleccionada.map((u) => {
                    const sucursal = etiquetaSucursalPorDefecto(u.sucursalPorDefecto);
                    return (
                      <Button
                        key={u.idPersonal}
                        type="button"
                        variant="outline"
                        role="listitem"
                        disabled={pending}
                        onClick={() => aplicarUsuario(u)}
                        className={cn(
                          "h-auto w-full justify-start px-3 py-2.5 text-left",
                          "whitespace-normal"
                        )}
                      >
                        <span className="flex min-w-0 flex-col items-start gap-0.5">
                          <span className="w-full truncate text-sm font-semibold tracking-wide">
                            {nombreUsuarioLabel(u.nombrePersonal)}
                          </span>
                          {sucursal ? (
                            <span className="text-xs font-medium text-muted-foreground">
                              {sucursal}
                            </span>
                          ) : null}
                        </span>
                      </Button>
                    );
                  })}
                </div>
                {usuariosSucursalSeleccionada.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay usuarios disponibles para esta sucursal.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </AppModal>
      </Dialog>

      <Dialog open={moduloOpen} onOpenChange={setModuloOpen}>
        <AppModal
          size="sm"
          title="Cambiar Módulo"
          padding="sm"
          actions={
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModuloOpen(false)}
              disabled={pending}
            >
              Cerrar
            </Button>
          }
        >
          <div
            className="flex w-full min-w-0 flex-col gap-2"
            role="list"
            aria-label="Módulos disponibles"
          >
            {(usuarioSesion?.modulosPermitidos ?? []).map((id) => {
              const area = getMainAppAreaById(id);
              const Icono = ICONO_MODULO[id];
              const activo = id === currentId;
              return (
                <Button
                  key={id}
                  type="button"
                  role="listitem"
                  variant={activo ? "default" : "outline"}
                  disabled={pending || !usuarioSesion}
                  onClick={() => {
                    if (!usuarioSesion) return;
                    aplicarModulo(usuarioSesion, id);
                  }}
                  className={cn(
                    "h-auto w-full justify-start gap-3 px-3 py-2.5 text-left",
                    "whitespace-normal"
                  )}
                >
                  <Icono className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate text-sm font-semibold tracking-wide">
                    {areaLabelMayusculas(area.label)}
                  </span>
                </Button>
              );
            })}
          </div>
        </AppModal>
      </Dialog>

      <Dialog open={claveOpen} onOpenChange={handleClaveOpenChange}>
        <AppModal
          size="sm"
          title={
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-accent2" />
              <span>Acceso A Administración</span>
            </div>
          }
          actions={
            <>
              <Button
                variant="ghost"
                onClick={handleCancelarClave}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleActivarYNavegar}
                disabled={pending || !clave || !pendingUsuario || !pendingAreaId}
              >
                {pending ? "Verificando..." : "Ingresar"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Ingresá la clave para entrar al módulo Administración.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="clave-area-admin">CLAVE</Label>
              <div className="relative">
                <Input
                  id="clave-area-admin"
                  type={mostrarClave ? "text" : "password"}
                  value={clave}
                  onChange={(e) => {
                    setClave(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleActivarYNavegar();
                  }}
                  placeholder="INGRESAR CLAVE"
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarClave((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                  aria-label={mostrarClave ? "Ocultar Clave" : "Mostrar Clave"}
                >
                  {mostrarClave ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
          </div>
        </AppModal>
      </Dialog>

      {transfPendienteOpen ? (
        <TransferenciaPendienteAvisoModal
          open
          onOpenChange={handleAvisoTransfOpenChange}
          onTransferirAhora={handleTransferirAhora}
        />
      ) : null}
    </>
  );
}
