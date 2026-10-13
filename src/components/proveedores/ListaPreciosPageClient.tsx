"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ImportarListaPreciosModal from "@/components/proveedores/ImportarListaPreciosModal";
import ConvertirPdfListaPreciosModal from "@/components/proveedores/ConvertirPdfListaPreciosModal";
import CrearProductoListaPreciosModal from "@/components/proveedores/CrearProductoListaPreciosModal";
import EdicionMasivaListaPreciosModal from "@/components/proveedores/EdicionMasivaListaPreciosModal";
import ExportarListaPreciosButton, {
  type ListaPreciosFiltrosExportSnapshot,
} from "@/components/proveedores/ExportarListaPreciosButton";
import ListaPreciosTablaConFiltros from "@/components/proveedores/ListaPreciosTablaConFiltros";
import CotizacionUsdListaPreciosControl from "@/components/proveedores/CotizacionUsdListaPreciosControl";
import ReglasDescuentosListaPrecioModal from "@/components/proveedores/ReglasDescuentosListaPrecioModal";
import type { CotizacionUsdEstado } from "@/actions/cotizacionUsd";
import { PERMISOS, puede, type Rol } from "@/lib/permisos";

interface ProveedorParaCliente {
  id: string;
  nombre: string;
  prefijo: string;
  codigoUnico: string;
}

interface MarcaOption {
  id: string;
  nombre: string;
}

interface RubroOption {
  id: string;
  nombre: string;
}

interface Props {
  proveedores: ProveedorParaCliente[];
  marcas: MarcaOption[];
  rubros: RubroOption[];
  rol: Rol;
  cotizacionUsd: CotizacionUsdEstado;
}

export default function ListaPreciosPageClient({
  proveedores,
  marcas,
  rubros,
  rol,
  cotizacionUsd,
}: Props) {
  const router = useRouter();
  const [reloadNonce, setReloadNonce] = useState(0);
  const [filtrosExportSnapshot, setFiltrosExportSnapshot] =
    useState<ListaPreciosFiltrosExportSnapshot>({
      filtros: null,
      hasFilterActive: false,
      total: 0,
    });

  const handleEdicionSuccess = useCallback(() => {
    setReloadNonce((n) => n + 1);
    router.refresh();
  }, [router]);

  const handleFiltrosExportSnapshotChange = useCallback(
    (snapshot: ListaPreciosFiltrosExportSnapshot) => {
      setFiltrosExportSnapshot(snapshot);
    },
    []
  );

  const p = PERMISOS.listaPrecios;
  const esEditorActivo = rol === "editor";
  const puedeImportar = esEditorActivo && puede(rol, p.acciones.importarLista);
  const puedeEdicionMasiva = esEditorActivo && puede(rol, p.acciones.edicionMasiva);
  const puedeGestionarCotizacion = puede(rol, p.acciones.gestionarCotizacionUsd);
  const puedeGestionarReglas = puede(rol, p.acciones.gestionarReglasDescuentos);
  const puedeVerCotizacion =
    puedeGestionarCotizacion ||
    puedeImportar ||
    puede(rol, PERMISOS.proveedores.listaPrecios);

  const actions =
    puedeImportar || puedeEdicionMasiva || puedeVerCotizacion || puedeGestionarReglas ? (
      <div className="flex flex-wrap items-center gap-2">
        {puedeVerCotizacion && (
          <CotizacionUsdListaPreciosControl
            puedeEditar={puedeGestionarCotizacion}
            estadoInicial={cotizacionUsd}
            onActualizada={handleEdicionSuccess}
          />
        )}
        {puedeImportar && (
          <CrearProductoListaPreciosModal
            proveedores={proveedores}
            marcas={marcas}
            onSuccess={handleEdicionSuccess}
          />
        )}
        {puedeEdicionMasiva && (
          <EdicionMasivaListaPreciosModal
            proveedores={proveedores}
            marcas={marcas}
            rubros={rubros}
            onSuccess={handleEdicionSuccess}
          />
        )}
        {puedeImportar && (
          <>
            <ExportarListaPreciosButton snapshot={filtrosExportSnapshot} />
            <ImportarListaPreciosModal proveedores={proveedores} cotizacionUsd={cotizacionUsd.valor} />
            <ConvertirPdfListaPreciosModal proveedores={proveedores} />
          </>
        )}
        {puedeGestionarReglas && (
          <ReglasDescuentosListaPrecioModal onSuccess={handleEdicionSuccess} />
        )}
      </div>
    ) : undefined;

  return (
    <ClassicFilteredTableLayout
      title="Proveedores"
      subtitle="Lista Prod. Prov."
      actions={actions}
    >
      <ListaPreciosTablaConFiltros
        proveedores={proveedores}
        marcas={marcas}
        rubros={rubros}
        puedeEdicionMasiva={puedeEdicionMasiva}
        reloadNonce={reloadNonce}
        onEdicionSuccess={handleEdicionSuccess}
        onFiltrosExportSnapshotChange={handleFiltrosExportSnapshotChange}
      />
    </ClassicFilteredTableLayout>
  );
}
