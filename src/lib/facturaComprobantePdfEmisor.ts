/** Snapshot fiscal del emisor en el PDF de comprobante (`ptos_vtas`). */

export type FacturaComprobantePdfEmisor = {
  cuit: string | null;
  razonSocial: string;
  iiBb: string | null;
  domicilio: string | null;
  inicioActividadesIso: string | null;
};

/** Datos de la autorización ARCA que la representación gráfica fiscal debe repetir. */
export type FacturaComprobantePdfFiscal = {
  cbteTipo: number;
  ptoVenta: number;
  cbteNro: number;
  cuitEmisor: string;
  leyendaEmisor: string;
  receptorDocTipo: number;
  receptorDocNro: string;
  receptorCondicionIva: number;
  receptorDomicilio: string | null;
  leyendaConsumidorFinal: boolean;
  discriminarIva: boolean;
  transparenciaFiscal: boolean;
  impNeto: number;
  impIva: number;
  impTrib: number;
  impTotal: number;
  moneda: string;
  cotizacion: number;
  alicuotas: { alicuota: number; baseImp: number; importe: number }[];
  /** PNG data URL. Lo completa el cliente antes de dibujar. */
  qrDataUrl?: string | null;
};

export function formatoCuitPdf(cuit: string | null | undefined): string {
  const d = (cuit ?? "").replace(/\D/g, "");
  if (d.length !== 11) return (cuit ?? "").trim();
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export function emisorPdfDesdePtoVta(pto: {
  titular: string;
  cuit: string | null;
  iiBb: string | null;
  domicilioComercial: string | null;
  inicioActividades: string | null;
}): FacturaComprobantePdfEmisor {
  return {
    cuit: pto.cuit,
    razonSocial: pto.titular.trim(),
    iiBb: pto.iiBb,
    domicilio: pto.domicilioComercial,
    inicioActividadesIso: pto.inicioActividades,
  };
}
