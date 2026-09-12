"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  ChevronDown,
  AlarmClock,
  Send,
  FileSearch,
  RotateCw,
  Pipette,
  Droplets,
  Receipt,
  CircleDollarSign,
  ListChecks,
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
  Sparkles,
  ScanSearch,
  Paintbrush,
  ArrowLeftRight,
  FilePlus2,
  Files,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import SyncStatusIndicator from "@/components/layout/SyncStatusIndicator";
import ImportStatusIndicator from "@/components/layout/ImportStatusIndicator";
import SidebarAreaSwitcher from "@/components/shared/SidebarAreaSwitcher";
import SidebarMainAppArea from "@/components/shared/SidebarMainAppArea";
import type { Rol } from "@/lib/permisos";
import { PERMISOS, puede } from "@/lib/permisos";
import { getMainAppAreaIdFromPathname } from "@/lib/main-app-areas";
import { GP_ROUTES, isGpRouteActive } from "@/lib/gestionProductosRoutes";
import { MARKETING_ROUTES } from "@/lib/marketingRoutes";
import { FACTURACION_ROUTES } from "@/lib/facturacionRoutes";
import AdministracionAccordionNav from "@/components/layout/AdministracionAccordionNav";
import SidebarNavDivider from "@/components/layout/SidebarNavDivider";

const iconClass = "h-5 w-5 shrink-0";

type ModuleId =
  | "pedidos"
  | "control-stock"
  | "asistencia-precios"
  | "calcular-lts"
  | "cargar-gastos"
  | "envios"
  | "asistente-ia";
type MarketingModuleId = "publicaciones" | "base-multimedia";
type FacturacionModuleId = "factura";
type SidebarModuleId = ModuleId | MarketingModuleId | FacturacionModuleId;

interface SubmoduleItem {
  /** Omitir en agrupadores solo desplegables (sin página propia). */
  href?: string;
  label: string;
  icon: React.ReactNode;
  isUrgente?: boolean;
  /** Permiso para ver este enlace (por rol). Si no se define, solo editor. */
  permiso?: { simple: boolean; editor: boolean };
  children?: SubmoduleItem[];
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
        label: "Cant. Pedida",
        icon: <ListChecks className="h-4 w-4 shrink-0" />,
        children: [
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
        ],
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
    id: "asistencia-precios",
    label: "PRECIOS",
    icon: <CircleDollarSign className={iconClass} />,
    submodules: [
      {
        href: GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido,
        label: "Px Sugeridos",
        icon: <FileSearch className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.proveedores.sugeridos,
      },
      {
        href: GP_ROUTES.ayudaVendedor.pxVenta.pxTintometrico,
        label: "Px Tintométricos",
        icon: <Pipette className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.tienda.tintoLts,
      },
    ],
  },
  {
    id: "calcular-lts",
    label: "CALCULAR LTS",
    icon: <Droplets className={iconClass} />,
    href: GP_ROUTES.ayudaVendedor.calcLitros,
    permiso: PERMISOS.tienda.tintoLts,
    submodules: [],
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
    id: "cargar-gastos",
    label: "CARGAR GASTOS",
    icon: <Receipt className={iconClass} />,
    href: GP_ROUTES.ayudaVendedor.cargarGasto,
    permiso: PERMISOS.ayudaVendedor.cargarGasto,
    submodules: [],
  },
  {
    id: "asistente-ia",
    label: "ASISTENTE IA",
    icon: <Sparkles className={iconClass} />,
    submodules: [
      {
        href: GP_ROUTES.asistenteIa.buscarColorImagen,
        label: "Buscar Cód. Imagen",
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

const FACTURACION_MODULES: NavModule[] = [
  {
    id: "factura",
    label: "FACTURA",
    icon: <Receipt className={iconClass} />,
    submodules: [
      {
        href: FACTURACION_ROUTES.factura.crear,
        label: "Crear",
        icon: <FilePlus2 className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.facturacion.acceso,
      },
      {
        href: FACTURACION_ROUTES.factura.facturas,
        label: "Facturas",
        icon: <Files className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.facturacion.acceso,
      },
      {
        href: FACTURACION_ROUTES.factura.presupuestos,
        label: "Presupuestos",
        icon: <ScrollText className="h-4 w-4 shrink-0" />,
        permiso: PERMISOS.facturacion.acceso,
      },
    ],
  },
];

function isSubmoduleActive(pathname: string, href: string): boolean {
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
    return pathname === FACTURACION_ROUTES.factura.crear;
  }
  if (href === FACTURACION_ROUTES.factura.facturas) {
    return pathname === FACTURACION_ROUTES.factura.facturas;
  }
  if (href === FACTURACION_ROUTES.factura.presupuestos) {
    return pathname === FACTURACION_ROUTES.factura.presupuestos;
  }
  return pathname === href;
}

function submoduleVisible(sub: SubmoduleItem, rol: Rol): boolean {
  if (sub.href) {
    const selfAllowed = !sub.permiso || puede(rol, sub.permiso);
    const childAllowed = sub.children?.some((c) => submoduleVisible(c, rol)) ?? false;
    return selfAllowed || childAllowed;
  }
  return sub.children?.some((c) => submoduleVisible(c, rol)) ?? false;
}

function isSubmoduleGroupActive(sub: SubmoduleItem, pathname: string): boolean {
  return (
    sub.children?.some((c) => (c.href ? isSubmoduleActive(pathname, c.href) : false)) ??
    false
  );
}

/** True si el módulo o algún descendiente coincide con la ruta (ancestro / enlace directo). */
function isNavModuleActive(module: NavModule, pathname: string): boolean {
  if (module.href && isSubmoduleActive(pathname, module.href)) return true;
  function walk(items: SubmoduleItem[]): boolean {
    for (const item of items) {
      if (item.href && isSubmoduleActive(pathname, item.href)) return true;
      if (item.children?.length && walk(item.children)) return true;
    }
    return false;
  }
  return walk(module.submodules);
}

function submoduleGroupKey(moduleId: SidebarModuleId, label: string): string {
  return `${moduleId}:${label}`;
}

/**
 * Si el módulo tiene exactamente un destino navegable visible, lo devuelve.
 * Grupos con un solo hijo también cuentan (abre ese hijo directo).
 */
function getSoleNavigableHref(module: NavModule, rol: Rol): string | null {
  const visible = module.submodules.filter((sub) => submoduleVisible(sub, rol));
  if (visible.length !== 1) return null;
  const only = visible[0]!;
  if (only.href && (!only.children || only.children.length === 0)) {
    return only.href;
  }
  if (!only.href && only.children?.length) {
    const kids = only.children.filter((c) => submoduleVisible(c, rol));
    if (kids.length === 1 && kids[0]?.href) return kids[0].href;
  }
  return null;
}

export default function Sidebar({ rol }: { rol: Rol }) {
  const pathname = usePathname();
  const mainAreaId = getMainAppAreaIdFromPathname(pathname);
  /** Acordeón: arranca cerrado; solo se abre por acción del usuario (no por ruta). */
  const [openId, setOpenId] = useState<SidebarModuleId | null>(null);
  const [openSubGroups, setOpenSubGroups] = useState<Set<string>>(() => new Set());
  const [areaKey, setAreaKey] = useState(mainAreaId);

  if (areaKey !== mainAreaId) {
    setAreaKey(mainAreaId);
    setOpenId(null);
    setOpenSubGroups(new Set());
  }

  const modulesForArea: NavModule[] =
    mainAreaId === "gestion-productos"
      ? MODULES
      : mainAreaId === "marketing"
        ? MARKETING_MODULES
        : mainAreaId === "facturacion"
          ? FACTURACION_MODULES
          : [];

  const visibleModules: NavModule[] = modulesForArea.filter((module) => {
    if (module.href && module.permiso && puede(rol, module.permiso)) return true;
    return module.submodules.some((sub) => submoduleVisible(sub, rol));
  });

  function toggleSubGroup(moduleId: SidebarModuleId, key: string, open: boolean) {
    setOpenSubGroups((prev) => {
      if (!open) {
        const next = new Set(prev);
        next.delete(key);
        return next;
      }
      const next = new Set(prev);
      for (const k of [...next]) {
        if (k.startsWith(`${moduleId}:`)) next.delete(k);
      }
      next.add(key);
      return next;
    });
  }

  function handleModuleOpenChange(module: NavModule, open: boolean) {
    if (!open) {
      setOpenId(null);
      setOpenSubGroups((prev) => {
        const next = new Set(prev);
        for (const k of [...next]) {
          if (k.startsWith(`${module.id}:`)) next.delete(k);
        }
        return next;
      });
      return;
    }
    setOpenId(module.id);
    // Si hay un agrupador activo por ruta, abrirlo junto con el módulo.
    for (const sub of module.submodules) {
      if (!sub.href && sub.children?.length && isSubmoduleGroupActive(sub, pathname)) {
        setOpenSubGroups((prev) => {
          const next = new Set(prev);
          for (const k of [...next]) {
            if (k.startsWith(`${module.id}:`)) next.delete(k);
          }
          next.add(submoduleGroupKey(module.id, sub.label));
          return next;
        });
        break;
      }
    }
  }

  function renderSubmoduleItems(
    submodules: SubmoduleItem[],
    moduleId: SidebarModuleId
  ) {
    const visible = submodules.filter((sub) => submoduleVisible(sub, rol));
    return visible.map((sub) => {
      if (!sub.href && sub.children?.length) {
        const groupKey = submoduleGroupKey(moduleId, sub.label);
        const kids = sub.children.filter((c) => submoduleVisible(c, rol));
        const soleChildHref =
          kids.length === 1 && kids[0]?.href ? kids[0].href : null;
        if (soleChildHref) {
          const active = isSubmoduleActive(pathname, soleChildHref);
          return (
            <div key={groupKey}>
              <Link
                href={soleChildHref}
                className={cn(
                  "sidebar-nav-item",
                  kids[0]?.isUrgente && "relative"
                )}
                data-active={active ? "true" : undefined}
                aria-current={active ? "page" : undefined}
              >
                {sub.icon}
                <span className="min-w-0 truncate">{sub.label}</span>
              </Link>
            </div>
          );
        }
        const isSubOpen = openSubGroups.has(groupKey);
        const groupActive = isSubmoduleGroupActive(sub, pathname);
        return (
          <div key={groupKey}>
            <Collapsible
              open={isSubOpen}
              onOpenChange={(open) => toggleSubGroup(moduleId, groupKey, open)}
              className="group/subcollapsible"
            >
              <CollapsibleTrigger
                className="sidebar-nav-item"
                data-ancestor={groupActive ? "true" : undefined}
                aria-expanded={isSubOpen}
              >
                {sub.icon}
                <span className="min-w-0 flex-1 truncate text-left">{sub.label}</span>
                <ChevronDown
                  className={cn(
                    "sidebar-nav-chevron h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    isSubOpen && "rotate-180"
                  )}
                  aria-hidden
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="sidebar-nav-tree sidebar-nav-tree--nested">
                  {renderSubmoduleItems(sub.children, moduleId)}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      }

      if (!sub.href) return null;

      const active = isSubmoduleActive(pathname, sub.href);
      return (
        <div key={sub.href}>
          <div className="space-y-0">
            <Link
              href={sub.href}
              className={cn("sidebar-nav-item", sub.isUrgente && "relative")}
              data-active={active ? "true" : undefined}
              aria-current={active ? "page" : undefined}
            >
              {sub.icon}
              <span className="min-w-0 truncate">{sub.label}</span>
            </Link>

            {sub.children && sub.children.length > 0 ? (
              <div className="sidebar-nav-tree sidebar-nav-tree--nested">
                {renderSubmoduleItems(sub.children, moduleId)}
              </div>
            ) : null}
          </div>
        </div>
      );
    });
  }

  return (
    <aside className="sidebar-container w-60 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
      <nav
        className="sidebar-nav-scroll flex min-h-0 flex-col gap-0.5 px-4 pt-3 pb-2"
        aria-label="Navegación principal"
      >
        {mainAreaId === "finanzas" ? (
          <AdministracionAccordionNav rol={rol} />
        ) : visibleModules.length > 0 ? (
          visibleModules.map((module, moduleIndex) => {
            const moduleDivider = moduleIndex > 0 ? <SidebarNavDivider /> : null;

            if (module.href) {
              const active = isSubmoduleActive(pathname, module.href);
              return (
                <div key={module.id}>
                  {moduleDivider}
                  <Link
                    href={module.href}
                    className="sidebar-nav-module"
                    data-active={active ? "true" : undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {module.icon}
                    </span>
                    <span className="min-w-0 flex-1 text-left">{module.label}</span>
                  </Link>
                </div>
              );
            }

            const soleHref = getSoleNavigableHref(module, rol);
            if (soleHref) {
              const active = isSubmoduleActive(pathname, soleHref);
              return (
                <div key={module.id}>
                  {moduleDivider}
                  <Link
                    href={soleHref}
                    className="sidebar-nav-module"
                    data-active={active ? "true" : undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {module.icon}
                    </span>
                    <span className="min-w-0 flex-1 text-left">{module.label}</span>
                  </Link>
                </div>
              );
            }

            const isOpen = openId === module.id;
            const moduleAncestor = isNavModuleActive(module, pathname);
            return (
              <div key={module.id}>
                {moduleDivider}
                <Collapsible
                  open={isOpen}
                  onOpenChange={(open) => handleModuleOpenChange(module, open)}
                  className="group/collapsible"
                >
                  <CollapsibleTrigger
                    className="sidebar-nav-module"
                    data-ancestor={moduleAncestor ? "true" : undefined}
                    aria-expanded={isOpen}
                  >
                    <span className="h-5 w-5 shrink-0 flex items-center justify-center">
                      {module.icon}
                    </span>
                    <span className="min-w-0 flex-1 text-left">{module.label}</span>
                    <ChevronDown
                      className={cn(
                        "sidebar-nav-chevron h-4 w-4 shrink-0 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                      aria-hidden
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="sidebar-nav-tree">
                      {renderSubmoduleItems(module.submodules, module.id)}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-sidebar-border/60 bg-sidebar-accent/20 px-3 py-3 text-xs text-sidebar-foreground/80">
            No Hay Módulos Disponibles En Esta Área.
          </div>
        )}
      </nav>
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
          <SidebarMainAppArea />
          <div
            className="mx-2 h-px shrink-0 bg-sidebar-foreground/40"
            aria-hidden
          />
          <SidebarAreaSwitcher rolActual={rol} />
        </div>
      </div>
    </aside>
  );
}
