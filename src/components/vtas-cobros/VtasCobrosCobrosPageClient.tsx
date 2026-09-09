"use client";

import {
  EmptyTableRow,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";

export default function VtasCobrosCobrosPageClient() {
  return (
    <div className="area-page-shell bg-gris">
      <ClassicFilteredTableLayout
        title="VTAS. & COBROS"
        subtitle="Cobros"
      >
        <div className="contenedor-tabla-gestion flex-1 min-h-0">
          <Table variant="compact">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-left">COBROS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <EmptyTableRow colSpan={1} message="NO HAY COBROS PARA MOSTRAR." />
            </TableBody>
          </Table>
        </div>
      </ClassicFilteredTableLayout>
    </div>
  );
}
