import type { ReactNode } from "react";
import LineaLecturaModal from "@/components/shared/LineaLecturaModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtCantidad } from "@/lib/cantidadUnDecimal";
import {
  claveFormaPagoCuotaDescPromo,
  ETIQUETA_ALCANCE_DESC_PROMO,
  etiquetaFormaPagoCuotaDescPromo,
  type DescPromoFila,
} from "@/lib/descPromo";
import { fmtCelda } from "@/lib/format";

const TITULO_SECCION_CLASS =
  "text-center text-xs font-bold uppercase tracking-wide text-foreground";

export function SeccionLecturaDescPromo({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="modal-seccion-formulario flex flex-col gap-2">
      <h3 className={TITULO_SECCION_CLASS}>{titulo}</h3>
      {children}
    </section>
  );
}

export function DescPromoFormasPagoLectura({ item }: { item: DescPromoFila }) {
  if (item.formasPago.length === 0) {
    return <p className="text-sm text-muted-foreground">SIN FORMAS DE PAGO.</p>;
  }
  return (
    <>
      {item.formasPago.map((fp, indice) => (
        <LineaLecturaModal
          key={claveFormaPagoCuotaDescPromo(fp.pagoId, fp.cuotaId)}
          etiqueta={`FORMA DE PAGO (${indice + 1})`}
          valor={fmtCelda(etiquetaFormaPagoCuotaDescPromo(fp))}
        />
      ))}
    </>
  );
}

/** MARCA / RUBRO: solo sus nombres; ÍTEMS: tabla (con lote si es DESC. POR STOCK). */
export function DescPromoAlcanceLectura({ item }: { item: DescPromoFila }) {
  if (item.alcance === "TODOS") {
    return (
      <LineaLecturaModal etiqueta="ALCANCE" valor={ETIQUETA_ALCANCE_DESC_PROMO.TODOS} />
    );
  }
  if (item.alcance !== "ITEMS") {
    return (
      <>
        {item.alcance !== "RUBRO" ? (
          <LineaLecturaModal etiqueta="MARCA" valor={fmtCelda(item.marcaNombre)} />
        ) : null}
        {item.alcance !== "MARCA" ? (
          <LineaLecturaModal etiqueta="RUBRO" valor={fmtCelda(item.rubroNombre)} />
        ) : null}
      </>
    );
  }
  if (item.items.length === 0) {
    return <p className="text-sm text-muted-foreground">SIN PRODUCTOS.</p>;
  }
  const esStock = item.categoria === "STOCK";
  return (
    <div className="contenedor-tabla-gestion min-h-0 max-h-[min(18rem,40vh)] overflow-auto rounded-md border border-primary">
      <Table variant="compact" className="tabla-gestion-compacta w-full">
        {esStock ? (
          <colgroup>
            <col className="w-[80%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
          </colgroup>
        ) : null}
        <TableHeader>
          <TableRow>
            <TableHead>DESCRIPCIÓN</TableHead>
            {esStock ? (
              <>
                <TableHead className="text-center">CANT. PROMO</TableHead>
                <TableHead className="text-center">CANT. RESTANTE</TableHead>
              </>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {item.items.map((prod) => {
            const etiqueta = prod.descripcion || prod.codTienda;
            return (
              <TableRow key={prod.codTienda}>
                <TableCell className="celda-datos min-w-0">
                  <span className="block truncate" title={etiqueta}>
                    {fmtCelda(etiqueta)}
                  </span>
                </TableCell>
                {esStock ? (
                  <>
                    <TableCell className="celda-datos text-center tabular-nums">
                      {fmtCantidad(prod.lote?.cantidad)}
                    </TableCell>
                    <TableCell className="celda-datos text-center tabular-nums">
                      {fmtCantidad(prod.lote?.saldo)}
                    </TableCell>
                  </>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
