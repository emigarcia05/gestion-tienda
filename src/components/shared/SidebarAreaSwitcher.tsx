"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
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
import { activarModoEditor } from "@/actions/sesion";
import { listUsuariosParaInicioSesionAction } from "@/actions/globalPersonal";
import {
  areaLabelMayusculas,
  getMainAppAreaById,
  getMainAppAreaIdFromPathname,
  isMainAppAreaId,
  type MainAppAreaId,
} from "@/lib/main-app-areas";
import type { GlobalPersonalItem } from "@/services/globalPersonal.service";
import {
  guardarUsuarioSesion,
  leerUsuarioSesion,
  usuarioSesionDesdeItem,
  type UsuarioSesion,
} from "@/lib/usuarioSesion";
import { type SucursalPreferida } from "@/lib/sucursalPreferida";
import {
  primerModuloPermitido,
  etiquetaSucursalPorDefecto,
} from "@/lib/usuarios";
import type { Rol } from "@/lib/permisos";
import SidebarModulosRecuadro from "@/components/layout/SidebarModulosRecuadro";
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

  const currentId = getMainAppAreaIdFromPathname(pathname);

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

  function persistirYNavegar(
    usuario: UsuarioSesion,
    areaId: MainAppAreaId
  ) {
    guardarUsuarioSesion(usuario);
    setUsuarioSesion(usuario);
    setForceChoose(false);
    setUsuarioOpen(false);
    setClaveOpen(false);
    setPendingUsuario(null);
    setPendingAreaId(null);
    if (getMainAppAreaIdFromPathname(pathname) !== areaId) {
      router.push(getMainAppAreaById(areaId).href);
    }
  }

  function pedirClave(usuario: UsuarioSesion, areaId: MainAppAreaId) {
    setPendingUsuario(usuario);
    setPendingAreaId(areaId);
    setUsuarioOpen(false);
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
    persistirYNavegar(usuario, destino);
  }

  function aplicarModulo(usuario: UsuarioSesion, areaId: MainAppAreaId) {
    if (areaId === currentId && !forceChoose) return;
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
      persistirYNavegar(pendingUsuario, pendingAreaId);
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

  const anclaModuloGeneral = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.getElementById("sidebar-modulo-general-ancla");
  }, []);

  const modulosGenerales = (usuarioSesion?.modulosPermitidos ?? []).map((id) => {
    const area = getMainAppAreaById(id);
    const Icono = ICONO_MODULO[id];
    return {
      id,
      label: areaLabelMayusculas(area.label),
      icon: <Icono className="h-5 w-5 shrink-0" aria-hidden />,
    };
  });
  const moduloGeneralActual =
    modulosGenerales.find((item) => item.id === currentId) ?? null;

  function abrirCambiarUsuario() {
    setUsuariosError("");
    setUsuarioOpen(true);
  }

  return (
    <>
      {anclaModuloGeneral && usuarioSesion
        ? createPortal(
            <SidebarModulosRecuadro
              modulos={modulosGenerales}
              seleccionado={moduloGeneralActual}
              placeholder="MÓDULO GENERAL"
              menuLabel="Módulos generales"
              nivel="general"
              onSelect={(id) => {
                if (!isMainAppAreaId(id) || !usuarioSesion) return;
                aplicarModulo(usuarioSesion, id);
              }}
            />,
            anclaModuloGeneral
          )
        : null}
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

    </>
  );
}
