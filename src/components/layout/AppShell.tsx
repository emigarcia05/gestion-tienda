"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { esRutaEnviosConductor } from "@/lib/gestionProductosRoutes";
import { esRutaCuentaCorrientePublica } from "@/lib/cuentaCorrientePublica";
import { esRutaIngreso } from "@/lib/ingreso";
import {
  notificarUsuarioSesion,
  sincronizarUsuarioSesion,
  type UsuarioSesion,
} from "@/lib/usuarioSesion";
import type { Rol } from "@/lib/permisos";

interface Props {
  children: React.ReactNode;
  rol: Rol;
  /** Usuario de la sesión del servidor (null en `/ingresar` y en el visor público). */
  usuario: UsuarioSesion | null;
}

function SidebarFallback() {
  return (
    <aside
      className="sidebar-container w-60 shrink-0 border-r border-sidebar-border bg-sidebar"
      aria-hidden
    />
  );
}

export default function AppShell({ children, rol, usuario }: Props) {
  const pathname = usePathname();
  const sinSidebar =
    usuario == null ||
    esRutaIngreso(pathname) ||
    esRutaEnviosConductor(pathname) ||
    esRutaCuentaCorrientePublica(pathname);

  // Antes de renderizar hijos: los componentes leen `leerUsuarioSesion()` al montar (pestaña nueva = storage vacío).
  if (typeof window !== "undefined" && usuario != null) sincronizarUsuarioSesion(usuario);

  useEffect(() => {
    if (usuario != null) notificarUsuarioSesion();
  }, [usuario]);

  if (esRutaIngreso(pathname)) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden">
      {sinSidebar ? null : (
        <Suspense fallback={<SidebarFallback />}>
          <Sidebar rol={rol} usuario={usuario} />
        </Suspense>
      )}
      <main className="flex-1 overflow-hidden bg-gris">{children}</main>
    </div>
  );
}
