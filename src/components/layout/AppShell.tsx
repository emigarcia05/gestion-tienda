"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { esRutaEnviosConductor } from "@/lib/gestionProductosRoutes";
import { esRutaCuentaCorrientePublica } from "@/lib/cuentaCorrientePublica";
import type { Rol } from "@/lib/permisos";

interface Props {
  children: React.ReactNode;
  rol: Rol;
}

function SidebarFallback() {
  return (
    <aside
      className="sidebar-container w-60 shrink-0 border-r border-sidebar-border bg-sidebar"
      aria-hidden
    />
  );
}

export default function AppShell({ children, rol }: Props) {
  const pathname = usePathname();
  const sinSidebar =
    esRutaEnviosConductor(pathname) || esRutaCuentaCorrientePublica(pathname);

  return (
    <div className="flex h-screen overflow-hidden">
      {sinSidebar ? null : (
        <Suspense fallback={<SidebarFallback />}>
          <Sidebar rol={rol} />
        </Suspense>
      )}
      <main className="flex-1 overflow-hidden bg-gris">{children}</main>
    </div>
  );
}
