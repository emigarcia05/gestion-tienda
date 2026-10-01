"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  AlarmClock,
  Send,
  FileSearch,
  RotateCw,
  Pipette,
  Droplets,
  Receipt,
  Plus,
  Wrench,
  PackageCheck,
  Boxes,
  Megaphone,
  CalendarRange,
  Lightbulb,
  Target,
  Images,
  Palette,
  CalendarClock,
  CircleUser,
  Truck,
  ScanSearch,
  Paintbrush,
  ArrowLeftRight,
  Files,
  ScrollText,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SyncStatusIndicator from "@/components/layout/SyncStatusIndicator";
import ImportStatusIndicator from "@/components/layout/ImportStatusIndicator";
import SidebarAreaSwitcher from "@/components/shared/SidebarAreaSwitcher";
import type { Rol } from "@/lib/permisos";
import { PERMISOS, puede } from "@/lib/permisos";
import { getMainAppAreaIdFromPathname } from "@/lib/main-app-areas";
import { GP_ROUTES, isGpRouteActive } from "@/lib/gestionProductosRoutes";
import { MARKETING_ROUTES } from "@/lib/marketingRoutes";
import { FACTURA_CREAR_QUERY_CLASE, FACTURACION_ROUTES } from "@/lib/facturacionRoutes";
import AdministracionAccordionNav from "@/components/layout/AdministracionAccordionNav";
import { FIN_PILLARS } from "@/lib/administracionNav";
import SidebarModulosRecuadro from "@/components/layout/SidebarModulosRecuadro";

const iconClass = "h-5 w-5 shrink-0";

type ModuleId =
  | "ventas"
  | "clientes"
  | "pedidos"
  | "control-stock"
  | "herramientas"
  | "envios";
type MarketingModuleId = "publicaciones" | "base-multimedia";
type SidebarModuleId = ModuleId | MarketingModuleId;

interface SubmoduleItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  isUrgente?: boolean;
  /** Permiso para ver este enlace (por rol). Si no se define, solo editor. */
  permiso?: { simple: boolean; editor: boolean };
}

type NavModule = {
  id: SidebarModuleId;
  label: string;
  icon: React.ReactNode;
  submodules: SubmoduleItem[];
  /** Enlace directo en sidebar (sin submódulos desplegables). */
  href?: string;
  permiso?: { simple: boolean; editor: boolean };
};

const MODULES: NavModule[] = [
  {
    id: "ventas",
    label: "VENTAS",
    icon: <Receipt className={iconClass} />,
    submodules: [
      {
        href: FACTURACION_ROUTES.factura.crear,
        label: "Crear",
        icon: <Plus className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.facturacion.acceso,
      },
      {
        href: FACTURACION_ROUTES.factura.facturas,
        label: "Comprobantes",
        icon: <Files className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.facturacion.acceso,
      },
      {
        href: FACTURACION_ROUTES.factura.presupuestos,
        label: "Presupuestos",
        icon: <ScrollText className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.facturacion.acceso,
      },
      {
        href: GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido,
        label: "Px Sugeridos",
        icon: <FileSearch className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.proveedores.sugeridos,
      },
      {
        href: GP_ROUTES.ayudaVendedor.pxVenta.pxTintometrico,
        label: "Px Tintométrico",
        icon: <Pipette className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.tienda.tintoLts,
      },
    ],
  },
  {
    id: "clientes",
    label: "CLIENTES",
    icon: <Users className={iconClass} />,
    submodules: [
      {
        href: FACTURACION_ROUTES.clientes.cuentaCorriente,
        label: "Cuentas Corrientes",
        icon: <Wallet className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.facturacion.acceso,
      },
      {
        href: FACTURACION_ROUTES.clientes.lista,
        label: "Lista Clientes",
        icon: <ClipboardList className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.facturacion.acceso,
      },
    ],
  },
  {
    id: "envios",
    label: "ENVIOS",
    icon: <Truck className={iconClass} />,
    submodules: [
      {
        href: GP_ROUTES.envios.programados,
        label: "Programados",
        icon: <CalendarClock className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.envios.acceso,
      },
      {
        href: GP_ROUTES.envios.conductor,
        label: "Conductor",
        icon: <CircleUser className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.envios.acceso,
      },
    ],
  },
  {
    id: "pedidos",
    label: "MERCADERÍA",
    icon: <ClipboardList className={iconClass} />,
    submodules: [
      {
        href: GP_ROUTES.pedidoMercaderia.confPedido.urgente,
        label: "Urgente",
        icon: <AlarmClock className="h-4 w-4 shrink-0" />,
        isUrgente: true,
        permiso: PERMISOS.pedidos.acceso,
      },
      {
        href: GP_ROUTES.pedidoMercaderia.confPedido.tintometrico,
        label: "Tintométrico",
        icon: <Pipette className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.pedidos.acceso,
      },
      {
        href: GP_ROUTES.pedidoMercaderia.confPedido.reposicion,
        label: "Reposición",
        icon: <RotateCw className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.pedidos.acceso,
      },
      {
        href: GP_ROUTES.pedidoMercaderia.generarPedido,
        label: "Generar Pedido",
        icon: <Send className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.pedidos.acceso,
      },
      {
        href: GP_ROUTES.pedidoMercaderia.recepcionPedido,
        label: "Recepción Pedido",
        icon: <PackageCheck className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.pedidos.acceso,
      },
    ],
  },
  {
    id: "control-stock",
    label: "STOCK",
    icon: <Boxes className={iconClass} />,
    submodules: [
      {
        href: GP_ROUTES.ayudaVendedor.controlStock,
        label: "Control Stock",
        icon: <Boxes className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.stock.acceso,
      },
      {
        href: GP_ROUTES.ayudaVendedor.transfDepositos,
        label: "Trans. Depósitos",
        icon: <ArrowLeftRight className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.stock.acceso,
      },
    ],
  },
  {
    id: "herramientas",
    label: "HERRAMIENTAS",
    icon: <Wrench className={iconClass} />,
    submodules: [
      {
        href: GP_ROUTES.ayudaVendedor.calcLitros,
        label: "Calculadora de Lts",
        icon: <Droplets className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.tienda.tintoLts,
      },
      {
        href: GP_ROUTES.asistenteIa.buscarColorImagen,
        label: "Buscar Cod. Imagen",
        icon: <ScanSearch className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.asistenteIa.acceso,
      },
      {
        href: GP_ROUTES.asistenteIa.disenarColores,
        label: "Diseñar",
        icon: <Paintbrush className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.asistenteIa.acceso,
      },
    ],
  },
];

const MARKETING_MODULES: NavModule[] = [
  {
    id: "publicaciones",
    label: "PUBLICACIONES",
    icon: <Megaphone className={iconClass} />,
    submodules: [
      {
        href: MARKETING_ROUTES.publicaciones.calendario,
        label: "Calendario",
        icon: <CalendarRange className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.marketing.acceso,
      },
      {
        href: MARKETING_ROUTES.publicaciones.ideas,
        label: "Ideas Contenido",
        icon: <Lightbulb className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.marketing.acceso,
      },
      {
        href: MARKETING_ROUTES.publicaciones.objetivos,
        label: "Objetivos",
        icon: <Target className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.marketing.acceso,
      },
    ],
  },
  {
    id: "base-multimedia",
    label: "BASE MULTIMEDIA",
    icon: <Images className={iconClass} />,
    submodules: [
      {
        href: MARKETING_ROUTES.baseMultimedia.contenido,
        label: "Base Multimedia",
        icon: <Images className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.marketing.acceso,
      },
      {
        href: MARKETING_ROUTES.baseMultimedia.coloresMarca,
        label: "Colores Marca",
        icon: <Palette className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.marketing.acceso,
      },
    ],
  },
];

function isSubmoduleActive(
  pathname: string,
  href: string,
  crearClase: string | null
): boolean {
  if (href.startsWith("/gestion-productos") || href.startsWith("/asistente-ia")) {
    return isGpRouteActive(pathname, href);
  }
  if (href === MARKETING_ROUTES.publicaciones.calendario) {
    return pathname === MARKETING_ROUTES.publicaciones.calendario;
  }
  if (href === MARKETING_ROUTES.publicaciones.ideas) {
    return pathname === MARKETING_ROUTES.publicaciones.ideas;
  }
  if (href === MARKETING_ROUTES.publicaciones.objetivos) {
    return pathname === MARKETING_ROUTES.publicaciones.objetivos;
  }
  if (href === MARKETING_ROUTES.baseMultimedia.contenido) {
    return pathname === MARKETING_ROUTES.baseMultimedia.contenido;
  }
  if (href === MARKETING_ROUTES.baseMultimedia.coloresMarca) {
    return pathname === MARKETING_ROUTES.baseMultimedia.coloresMarca;
  }
  if (href === FACTURACION_ROUTES.factura.crear) {
    return (
      pathname === FACTURACION_ROUTES.factura.crear && crearClase !== "presupuesto"
    );
  }
  if (href === FACTURACION_ROUTES.factura.facturas) {
    return pathname === FACTURACION_ROUTES.factura.facturas;
  }
  if (href === FACTURACION_ROUTES.factura.presupuestos) {
    return (
      pathname === FACTURACION_ROUTES.factura.presupuestos ||
      (pathname === FACTURACION_ROUTES.factura.crear &&
        crearClase === "presupuesto")
    );
  }
  if (href === FACTURACION_ROUTES.clientes.lista) {
    return pathname === FACTURACION_ROUTES.clientes.lista;
  }
  if (href === FACTURACION_ROUTES.clientes.cuentaCorriente) {
    return pathname === FACTURACION_ROUTES.clientes.cuentaCorriente;
  }
  return pathname === href;
}

function submoduleVisible(sub: SubmoduleItem, rol: Rol): boolean {
  return !sub.permiso || puede(rol, sub.permiso);
}

function isNavModuleActive(
  module: NavModule,
  pathname: string,
  crearClase: string | null
): boolean {
  if (module.href && isSubmoduleActive(pathname, module.href, crearClase)) return true;
  return module.submodules.some((item) =>
    isSubmoduleActive(pathname, item.href, crearClase)
  );
}

export default function Sidebar({ rol }: { rol: Rol }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const crearClase = searchParams.get(FACTURA_CREAR_QUERY_CLASE);
  const mainAreaId = getMainAppAreaIdFromPathname(pathname);
  const [pickedId, setPickedId] = useState<SidebarModuleId | null>(null);
  const [areaKey, setAreaKey] = useState(mainAreaId);

  if (areaKey !== mainAreaId) {
    setAreaKey(mainAreaId);
    setPickedId(null);
  }

  const modulesForArea: NavModule[] =
    mainAreaId === "gestion-productos"
      ? MODULES
      : mainAreaId === "marketing"
        ? MARKETING_MODULES
        : [];

  const visibleModules: NavModule[] = modulesForArea.filter((module) => {
    if (module.href && module.permiso && puede(rol, module.permiso)) return true;
    return module.submodules.some((sub) => submoduleVisible(sub, rol));
  });

  const routeModule =
    visibleModules.find((module) =>
      isNavModuleActive(module, pathname, crearClase)
    ) ?? null;
  const selectedModule =
    (pickedId
      ? visibleModules.find((module) => module.id === pickedId)
      : null) ??
    routeModule ??
    visibleModules[0] ??
    null;

  function onSelectModule(id: string) {
    const elegido = visibleModules.find((item) => item.id === id);
    if (!elegido) return;
    setPickedId(elegido.id);
    if (elegido.href) {
      router.push(elegido.href);
    }
  }

  function renderSubmoduleItems(submodules: SubmoduleItem[]) {
    const visible = submodules.filter((sub) => submoduleVisible(sub, rol));
    return visible.map((sub) => {
      const active = isSubmoduleActive(pathname, sub.href, crearClase);
      return (
        <div key={sub.href}>
          <Link
            href={sub.href}
            className={cn("sidebar-nav-item", sub.isUrgente && "relative")}
            data-active={active ? "true" : undefined}
            aria-current={active ? "page" : undefined}
          >
            {sub.icon}
            <span className="min-w-0 truncate">{sub.label}</span>
          </Link>
        </div>
      );
    });
  }

  const navVacio = (
    <div className="rounded-lg border border-sidebar-border/60 bg-sidebar-accent/20 px-3 py-3 text-xs text-sidebar-foreground/80">
      No Hay Módulos Disponibles En Esta Área.
    </div>
  );

  return (
    <aside className="sidebar-container w-60 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-2">
        <div id="sidebar-modulo-general-ancla" className="shrink-0" />
        {mainAreaId === "finanzas" ? (
          <AdministracionAccordionNav rol={rol} />
        ) : mainAreaId === "area-finanzas" ? (
          <AdministracionAccordionNav rol={rol} pillars={FIN_PILLARS} />
        ) : visibleModules.length > 0 ? (
          <>
            <SidebarModulosRecuadro
              modulos={visibleModules.map((module) => ({
                id: module.id,
                label: module.label,
                icon: module.icon,
              }))}
              seleccionado={
                selectedModule
                  ? {
                      id: selectedModule.id,
                      label: selectedModule.label,
                      icon: selectedModule.icon,
                    }
                  : null
              }
              placeholder="MÓDULO"
              menuLabel="Módulos"
              onSelect={onSelectModule}
            />
            <nav
              className="sidebar-nav-scroll flex min-h-0 flex-1 flex-col gap-0.5"
              aria-label="Submódulos"
            >
              {selectedModule && !selectedModule.href ? (
                <div className="sidebar-nav-tree">
                  {renderSubmoduleItems(selectedModule.submodules)}
                </div>
              ) : null}
            </nav>
          </>
        ) : (
          <nav
            className="sidebar-nav-scroll flex min-h-0 flex-1 flex-col gap-0.5"
            aria-label="Navegación principal"
          >
            {navVacio}
          </nav>
        )}
      </div>
      <div className="mt-auto flex flex-col gap-2 px-4 pb-3">
        <div className="flex justify-center" aria-hidden>
          <div className="h-px w-[80%] shrink-0 bg-sidebar-foreground/85" />
        </div>
        <div className="flex flex-col gap-2">
          <SyncStatusIndicator rol={rol} />
          <ImportStatusIndicator pollEnabled={rol === "editor"} />
        </div>
        <div
          className={cn(
            "sidebar-user-switcher-surface flex w-full min-w-0 flex-col gap-0.5 rounded-lg p-1"
          )}
          aria-label="Sesión"
        >
          <SidebarAreaSwitcher rolActual={rol} />
        </div>
        <img
          src="/logo_tiendacolor_letras_blancas.png"
          alt="TiendaColor Pinturerías"
          className="mx-auto h-auto w-[50%] object-contain"
        />
      </div>
    </aside>
  );
}
