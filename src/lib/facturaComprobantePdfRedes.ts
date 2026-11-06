/** Pie de redes del PDF de comprobante. Instagram es único; WhatsApp sale de `sucursales.whatsapp`. */

export const INSTAGRAM_COMPROBANTE = "tiendacolor.pinturerias";
export const INSTAGRAM_COMPROBANTE_URL = "https://www.instagram.com/tiendacolor.pinturerias";

export type SucursalWhatsappPdf = {
  codigo: string;
  whatsapp: string | null;
};

/** Número de la sucursal del comprobante. Si se conoce el código, no se toma el de otra sucursal. */
export function whatsappDeSucursales(
  links: readonly SucursalWhatsappPdf[],
  sucursalCodigo: string | null | undefined
): string | null {
  const codigo = sucursalCodigo?.trim().toLowerCase() ?? "";
  if (codigo) {
    const propia = links.find((link) => link.codigo.trim().toLowerCase() === codigo);
    const texto = propia?.whatsapp?.trim() ?? "";
    return texto || null;
  }
  const cualquiera = links.find((link) => digitosWhatsapp(link.whatsapp).length > 0);
  return cualquiera?.whatsapp?.trim() || null;
}

export function digitosWhatsapp(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** Texto impreso: sin 54 / 549, para que quede el número local (261…). */
export function textoWhatsappPdf(raw: string | null | undefined): string {
  let digitos = digitosWhatsapp(raw);
  if (digitos.startsWith("549")) digitos = digitos.slice(3);
  else if (digitos.startsWith("54")) digitos = digitos.slice(2);
  return digitos;
}

/** `wa.me` con el número internacional guardado. Si vino local, se antepone 549. */
export function urlWhatsappPdf(raw: string | null | undefined): string | null {
  let digitos = digitosWhatsapp(raw);
  if (!digitos) return null;
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (!digitos.startsWith("54")) digitos = `549${digitos}`;
  return `https://wa.me/${digitos}`;
}

type QrCodeApi = {
  toDataURL: (
    text: string,
    options: { errorCorrectionLevel: "M"; margin: number; width: number }
  ) => Promise<string>;
};

async function dataUrlQr(texto: string): Promise<string> {
  const cargado = (await import("qrcode")) as QrCodeApi & { default?: QrCodeApi };
  const api = typeof cargado.toDataURL === "function" ? cargado : cargado.default;
  if (!api) throw new Error("No se pudo generar el código QR.");
  return api.toDataURL(texto, { errorCorrectionLevel: "M", margin: 1, width: 280 });
}

export type FacturaComprobantePdfRedes = {
  instagramQr: string;
  whatsappQr: string | null;
  whatsappTexto: string | null;
};

export async function redesPdfDeWhatsapp(
  whatsapp: string | null | undefined
): Promise<FacturaComprobantePdfRedes> {
  const urlWhatsapp = urlWhatsappPdf(whatsapp);
  const [instagramQr, whatsappQr] = await Promise.all([
    dataUrlQr(INSTAGRAM_COMPROBANTE_URL),
    urlWhatsapp ? dataUrlQr(urlWhatsapp) : Promise.resolve(null),
  ]);
  return {
    instagramQr,
    whatsappQr,
    whatsappTexto: textoWhatsappPdf(whatsapp) || null,
  };
}
