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
  type AdmPillarDef,
  type AdmPillarId,
  type AdmScreenDef,
} from "@/lib/administracionNav";
import { ADM_ICON_MAP } from "@/lib/administracionNavIcons";
import { puede, type Rol } from "@/lib/permisos";
import SidebarModulosRecuadro from "@/components/layout/SidebarModulosRecuadro";

const iconClass = "h-5 w-5 shrink-0";
const subIconClass = "h-4 w-4 shrink-0";

const TREE_PANEL = "sidebar-nav-tree";
const TREE_PANEL_NESTED = "sidebar-nav-tree sidebar-nav-tree--nested";

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

  const groupActive = isAdmGroupActive(pathname, group);
  const nestedGroups = group.groups ?? [];
  const directScreens = group.screens ?? [];

  return (
    <div>
      <div className="sidebar-nav-item" data-ancestor={groupActive ? "true" : undefined}>
        <Icon className={subIconClass} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
      </div>
      <div className={TREE_PANEL_NESTED}>
        {directScreens.length > 0 ? (
          <ScreensList screens={directScreens} pathname={pathname} />
        ) : null}
        {nestedGroups.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {nestedGroups.map((nested) => (
              <GroupBranch key={nested.id} group={nested} pathname={pathname} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Recuadro de pilares + submódulos debajo.
 * Administración usa `ADM_PILLARS`; el módulo Finanzas pasa `FIN_PILLARS`.
 */
export default function AdministracionAccordionNav({
  rol,
  pillars = ADM_PILLARS,
}: {
  rol: Rol;
  pillars?: AdmPillarDef[];
}) {
  const pathname = usePathname();
  const puedeFn = (permiso: { simple: boolean; editor: boolean }) =>
    puede(rol, permiso);

  const visiblePillars = pillars.filter((p) =>
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
    routePillar;

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
