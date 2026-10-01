"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ADM_PILLARS,
  filterVisibleGroups,
  filterVisibleScreens,
  isAdmGroupActive,
  isAdmPillarActive,
  isAdmScreenActive,
  pillarHasVisibleItems,
  type AdmGroupDef,
  type AdmPillarId,
  type AdmScreenDef,
} from "@/lib/administracionNav";
import { ADM_ICON_MAP } from "@/lib/administracionNavIcons";
import { puede, type Rol } from "@/lib/permisos";
import SidebarModulosRecuadro from "@/components/layout/SidebarModulosRecuadro";
import SidebarSubmoduloFlyout from "@/components/layout/SidebarSubmoduloFlyout";

const iconClass = "h-5 w-5 shrink-0";
const subIconClass = "h-4 w-4 shrink-0";

const TREE_PANEL = "sidebar-nav-tree";

function ScreenLink({
  screen,
  pathname,
}: {
  screen: AdmScreenDef;
  pathname: string;
}) {
  const Icon = ADM_ICON_MAP[screen.icon];
  const active = isAdmScreenActive(pathname, screen);
  return (
    <Link
      href={screen.href}
      className="sidebar-nav-item"
      data-active={active ? "true" : undefined}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={subIconClass} aria-hidden />
      <span className="min-w-0 truncate">{screen.label}</span>
    </Link>
  );
}

function ScreensList({
  screens,
  pathname,
}: {
  screens: AdmScreenDef[];
  pathname: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {screens.map((screen) => (
        <div key={screen.id}>
          <ScreenLink screen={screen} pathname={pathname} />
        </div>
      ))}
    </div>
  );
}

function collectGroupScreens(group: AdmGroupDef): AdmScreenDef[] {
  const fromScreens = group.screens ?? [];
  const fromGroups = (group.groups ?? []).flatMap(collectGroupScreens);
  return [...fromScreens, ...fromGroups];
}

function getSoleScreenHrefForGroup(group: AdmGroupDef): string | null {
  const allScreens = collectGroupScreens(group);
  if (allScreens.length === 1) return allScreens[0]!.href;
  return null;
}

function FuncionesDeGrupo({
  group,
  pathname,
}: {
  group: AdmGroupDef;
  pathname: string;
}) {
  const directScreens = group.screens ?? [];
  const nestedGroups = group.groups ?? [];
  return (
    <>
      {directScreens.length > 0 ? (
        <ScreensList screens={directScreens} pathname={pathname} />
      ) : null}
      {nestedGroups.map((nested) => {
        const soleHref = getSoleScreenHrefForGroup(nested);
        if (soleHref) {
          const soleScreen = collectGroupScreens(nested).find((s) => s.href === soleHref);
          const active = soleScreen
            ? isAdmScreenActive(pathname, soleScreen)
            : isAdmGroupActive(pathname, nested);
          const Icon = ADM_ICON_MAP[nested.icon];
          return (
            <Link
              key={nested.id}
              href={soleHref}
              className="sidebar-nav-item"
              role="menuitem"
              data-active={active ? "true" : undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={subIconClass} aria-hidden />
              <span className="min-w-0 truncate">{nested.label}</span>
            </Link>
          );
        }
        return (
          <div key={nested.id}>
            <p className="sidebar-funciones-seccion">{nested.label}</p>
            <FuncionesDeGrupo group={nested} pathname={pathname} />
          </div>
        );
      })}
    </>
  );
}

function GroupBranch({
  group,
  pathname,
}: {
  group: AdmGroupDef;
  pathname: string;
}) {
  const Icon = ADM_ICON_MAP[group.icon];
  const soleHref = getSoleScreenHrefForGroup(group);
  if (soleHref) {
    const soleScreen = collectGroupScreens(group).find((s) => s.href === soleHref);
    const active = soleScreen
      ? isAdmScreenActive(pathname, soleScreen)
      : isAdmGroupActive(pathname, group);
    return (
      <Link
        href={soleHref}
        className="sidebar-nav-item"
        data-active={active ? "true" : undefined}
        aria-current={active ? "page" : undefined}
      >
        <Icon className={subIconClass} aria-hidden />
        <span className="min-w-0 truncate">{group.label}</span>
      </Link>
    );
  }

  return (
    <SidebarSubmoduloFlyout
      label={group.label}
      icon={<Icon className={subIconClass} aria-hidden />}
      activo={isAdmGroupActive(pathname, group)}
    >
      <FuncionesDeGrupo group={group} pathname={pathname} />
    </SidebarSubmoduloFlyout>
  );
}

/**
 * Sidebar Administración: recuadro de pilares + submódulos debajo.
 * SSOT `administracionNav.ts`.
 */
export default function AdministracionAccordionNav({ rol }: { rol: Rol }) {
  const pathname = usePathname();
  const puedeFn = (permiso: { simple: boolean; editor: boolean }) =>
    puede(rol, permiso);

  const visiblePillars = ADM_PILLARS.filter((p) =>
    pillarHasVisibleItems(p, puedeFn)
  );

  const [pickedId, setPickedId] = useState<AdmPillarId | null>(null);

  if (visiblePillars.length === 0) {
    return (
      <div className="rounded-lg border border-sidebar-border/60 bg-sidebar-accent/20 px-3 py-3 text-xs text-sidebar-foreground/80">
        No Hay Módulos Disponibles En Esta Área.
      </div>
    );
  }

  const routePillar =
    visiblePillars.find((p) => isAdmPillarActive(pathname, p)) ?? null;
  const selectedPillar =
    (pickedId ? visiblePillars.find((p) => p.id === pickedId) : null) ??
    routePillar ??
    visiblePillars[0] ??
    null;

  const groups = selectedPillar?.groups
    ? filterVisibleGroups(selectedPillar.groups, puedeFn)
    : [];
  const screens = selectedPillar?.screens
    ? filterVisibleScreens(selectedPillar.screens, puedeFn)
    : [];
  const SelectedIcon = selectedPillar
    ? ADM_ICON_MAP[selectedPillar.icon]
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <SidebarModulosRecuadro
        modulos={visiblePillars.map((pillar) => {
          const Icon = ADM_ICON_MAP[pillar.icon];
          return {
            id: pillar.id,
            label: pillar.label,
            icon: <Icon className={iconClass} aria-hidden />,
          };
        })}
        seleccionado={
          selectedPillar && SelectedIcon
            ? {
                id: selectedPillar.id,
                label: selectedPillar.label,
                icon: <SelectedIcon className={iconClass} aria-hidden />,
              }
            : null
        }
        placeholder="MÓDULO"
        menuLabel="Módulos"
        onSelect={(id) => {
          const pillar = visiblePillars.find((item) => item.id === id);
          if (pillar) setPickedId(pillar.id);
        }}
      />
      <nav
        className="sidebar-nav-scroll flex min-h-0 flex-1 flex-col gap-0.5"
        aria-label="Submódulos"
      >
        {selectedPillar ? (
          <div className={TREE_PANEL}>
            <div className="flex flex-col gap-0.5">
              {screens.length > 0 ? (
                <ScreensList screens={screens} pathname={pathname} />
              ) : null}
              {groups.map((group) => (
                <GroupBranch key={group.id} group={group} pathname={pathname} />
              ))}
            </div>
          </div>
        ) : null}
      </nav>
    </div>
  );
}
