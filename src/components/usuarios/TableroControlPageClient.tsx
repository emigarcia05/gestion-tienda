"use client";

import { useState } from "react";
import { toast } from "sonner";
import { asignarVistaTableroUsuarioAction } from "@/actions/globalPersonal";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { esVistaTablero, type VistaTablero } from "@/lib/usuarios";
import type { GlobalPersonalItem } from "@/services/globalPersonal.service";

const OPCIONES: { id: VistaTablero; etiqueta: string }[] = [
  { id: "gerente", etiqueta: "GERENTE" },
  { id: "vendedor", etiqueta: "VENDEDOR" },
];

export default function TableroControlPageClient({ items }: { items: GlobalPersonalItem[] }) {
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [vistas, setVistas] = useState<Record<number, VistaTablero>>({});

  async function cambiar(idPersonal: number, vista: VistaTablero) {
    const previa = vistas[idPersonal];
    setVistas((actual) => ({ ...actual, [idPersonal]: vista }));
    setGuardandoId(idPersonal);
    const resultado = await asignarVistaTableroUsuarioAction({ idPersonal, vistaTablero: vista });
    setGuardandoId(null);
    if (!resultado.ok) {
      setVistas((actual) => {
        const siguiente = { ...actual };
        if (previa) siguiente[idPersonal] = previa;
        else delete siguiente[idPersonal];
        return siguiente;
      });
      toast.error(resultado.error);
    }
  }

  return (
    <ClassicFilteredTableLayout title="Usuarios" subtitle="Tablero Control" contentWidth="full">
      <div className="contenedor-tabla-gestion">
        <Table>
          <colgroup>
            <col style={{ width: "50%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <EmptyTableRow colSpan={3} message="No hay usuarios." />
            ) : (
              items.map((item) => {
                const vista = vistas[item.idPersonal] ?? item.vistaTablero;
                return (
                  <TableRow key={item.idPersonal}>
                    <TableCell className="truncate" title={item.nombrePersonal}>
                      {item.nombrePersonal}
                    </TableCell>
                    <TableCell>
                      {item.sucursalPorDefecto?.toLocaleUpperCase("es") ?? ""}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={vista}
                        disabled={guardandoId === item.idPersonal}
                        onValueChange={(valor) => {
                          if (esVistaTablero(valor)) void cambiar(item.idPersonal, valor);
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          className="w-full uppercase"
                          aria-label={`Tipo de tablero de ${item.nombrePersonal}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          searchable={false}
                          className="select-content-filtro"
                          position="popper"
                          side="bottom"
                          align="start"
                        >
                          {OPCIONES.map((opcion) => (
                            <SelectItem key={opcion.id} value={opcion.id}>
                              {opcion.etiqueta}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </ClassicFilteredTableLayout>
  );
}
