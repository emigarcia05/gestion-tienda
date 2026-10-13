"use client";

import { useLayoutEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  Landmark,
  LogOut,
  Megaphone,
  Scale,
  Store,
  User,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { cerrarSesionAction } from "@/actions/sesion";
import {
  areaLabelMayusculas,
  getMainAppAreaById,
  getMainAppAreaIdFromPathname,
  isMainAppAreaId,
  type MainAppAreaId,
} from "@/lib/main-app-areas";
import { borrarUsuarioSesion, type UsuarioSesion } from "@/lib/usuarioSesion";
import { etiquetaSucursalPorDefecto } from "@/lib/usuarios";
import { RUTA_INGRESO } from "@/lib/ingreso";
import SidebarModulosRecuadro from "@/components/layout/SidebarModulosRecuadro";
import { cn } from "@/lib/utils";

interface Props {
  /** Usuario que ingresó en `/ingresar` (sesión del servidor). */
  usuario: UsuarioSesion;
}

const ICONO_MODULO: Record<MainAppAreaId, LucideIcon> = {
  "gestion-productos": Store,
  finanzas: Landmark,
  marketing: Megaphone,
  "area-finanzas": Scale,
};

function nombreUsuarioLabel(nombre: string): string {
  return nombre.toLocaleUpperCase("es-AR");
}

/**
 * Pie de slidenav: ícono `User` + nombre, y debajo la sucursal.
 * Vive dentro del dock de sesión (`sidebar-user-switcher-surface` en `Sidebar`).
 * Módulos generales: solo los habilitados del usuario, sin clave.
 * Tocar el usuario abre **Cerrar sesión** (vuelve a `/ingresar`).
 */
export default function SidebarAreaSwitcher({ usuario }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [salirOpen, setSalirOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [anclaModuloGeneral, setAnclaModuloGeneral] =
    useState<HTMLElement | null>(null);

  const currentId = getMainAppAreaIdFromPathname(pathname);

  useLayoutEffect(() => {
    setAnclaModuloGeneral(
      document.getElementById("sidebar-modulo-general-ancla")
    );
  }, [pathname]);

  function aplicarModulo(areaId: MainAppAreaId) {
    if (areaId === currentId || !usuario.modulosPermitidos.includes(areaId)) return;
    router.push(getMainAppAreaById(areaId).href);
  }

  function handleCerrarSesion() {
    startTransition(async () => {
      const res = await cerrarSesionAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      borrarUsuarioSesion();
      setSalirOpen(false);
      router.replace(RUTA_INGRESO);
      router.refresh();
    });
  }

  const modulosGenerales = usuario.modulosPermitidos.map((id) => {
    const area = getMainAppAreaById(id);
    const Icono = ICONO_MODULO[id];
    return {
      id,
      label: areaLabelMayusculas(area.label),
      icon: <Icono className="h-5 w-5 shrink-0" aria-hidden />,
    };
  });
  const moduloGeneralActual =
    modulosGenerales.find((item) => item.id === currentId) ??
    modulosGenerales[0] ??
    null;
  const labelUsuario = nombreUsuarioLabel(usuario.nombrePersonal);
  const etiquetaSucursal = etiquetaSucursalPorDefecto(usuario.sucursalPorDefecto);

  return (
    <>
      {anclaModuloGeneral
        ? createPortal(
            <SidebarModulosRecuadro
              modulos={modulosGenerales}
              seleccionado={moduloGeneralActual}
              placeholder="MÓDULO GENERAL"
              menuLabel="Módulos generales"
              nivel="general"
              onSelect={(id) => {
                if (isMainAppAreaId(id)) aplicarModulo(id);
              }}
            />,
            anclaModuloGeneral
          )
        : null}
      <button
        type="button"
        onClick={() => setSalirOpen(true)}
        disabled={pending}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className={cn(
          "flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-md px-2 py-1",
          "text-center text-xs font-semibold tracking-wide",
          "text-sidebar-foreground",
          "outline-none hover:bg-sidebar-accent/80",
          "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          pending && "cursor-not-allowed opacity-90"
        )}
      >
        <User className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-col items-center leading-tight">
          <span className="w-full truncate">{labelUsuario}</span>
          {etiquetaSucursal ? (
            <span className="w-full truncate text-[0.65rem] font-medium">
              {etiquetaSucursal}
            </span>
          ) : null}
        </span>
      </button>

      <Dialog open={salirOpen} onOpenChange={(open) => !pending && setSalirOpen(open)}>
        <AppModal
          size="sm"
          title={
            <div className="flex items-center gap-2">
              <LogOut className="h-5 w-5" aria-hidden />
              <span>Cerrar Sesión</span>
            </div>
          }
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSalirOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleCerrarSesion} disabled={pending}>
                {pending ? "Saliendo..." : "Cerrar Sesión"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-foreground">
            Vas a salir como <span className="font-semibold">{labelUsuario}</span>. Para volver
            a entrar (o cambiar de usuario) se pide la contraseña.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
