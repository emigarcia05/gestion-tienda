import LineaLecturaModal from "@/components/shared/LineaLecturaModal";
import type { TesoreriaMovimientoFila } from "@/services/tesoreriaMovimientos.service";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtCelda, fmtPrecio } from "@/lib/format";

export function categoriaDetalleMovimiento(fila: TesoreriaMovimientoFila): string {
  if (fila.catMovimiento !== "COBRO") return fila.categoriaEtiqueta;
  const partes = [fila.pagoNombre, fila.entidadNombre, fila.cuotaEtiqueta].filter(
    (v) => v.trim().length > 0
  );
  if (partes.length === 0) return fila.categoriaEtiqueta;
  return `${fila.categoriaEtiqueta}: ${partes.join(" - ")}`;
}

function costoFinancieroTexto(valor: number | null): string {
  if (valor == null) return "";
  return `${valor.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

const TITULO_SECCION_CLASS =
  "text-center text-xs font-bold uppercase tracking-wide text-foreground";

export default function DetalleMovimientoTesoreriaCuerpo({
  fila,
}: {
  fila: TesoreriaMovimientoFila;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="modal-seccion-formulario">
        <p className={TITULO_SECCION_CLASS}>REGISTRO</p>
        <LineaLecturaModal
          etiqueta="FECHA REGISTRO"
          valor={formatIsoYmdDdMmYyyyArgentina(fila.fechaRegistroIso)}
        />
        <LineaLecturaModal etiqueta="SUCURSAL" valor={fmtCelda(fila.sucursalNombre)} />
        <LineaLecturaModal etiqueta="USUARIO" valor={fmtCelda(fila.usuarioNombre)} />
        <LineaLecturaModal etiqueta="TIPO" valor={fmtCelda(fila.tipoEtiqueta)} />
        <LineaLecturaModal etiqueta="CATEGORÍA" valor={categoriaDetalleMovimiento(fila)} />
        <LineaLecturaModal etiqueta="MONTO" valor={`$${fmtPrecio(fila.monto)}`} tabular />
      </section>
      <section className="modal-seccion-formulario">
        <p className={TITULO_SECCION_CLASS}>ACREDITACIÓN</p>
        <LineaLecturaModal
          etiqueta="FECHA ACREDITACIÓN"
          valor={formatIsoYmdDdMmYyyyArgentina(fila.fechaAcreditacionIso)}
        />
        <LineaLecturaModal
          etiqueta="CX FINANCIERO"
          valor={costoFinancieroTexto(fila.costoFinanciero)}
        />
        <LineaLecturaModal
          etiqueta="MONTO A ACREDITAR"
          valor={`$${fmtPrecio(fila.montoAcreditado)}`}
          tabular
        />
        <LineaLecturaModal etiqueta="CUENTA A ACREDITAR" valor={fmtCelda(fila.cajaEtiqueta)} />
      </section>
    </div>
  );
}
