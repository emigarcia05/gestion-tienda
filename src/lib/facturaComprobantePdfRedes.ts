/** Pie de redes del PDF de comprobante. Instagram es único; WhatsApp sale de `sucursales.whatsapp`. */

import logoWhatsapp from "../../fuentes_logos/Logo Whatsapp.png";

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
  /** PNG de `fuentes_logos/Logo Whatsapp.png`, recortado al dibujo. */
  whatsappIcono: string;
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
    whatsappIcono: await dataUrlLogoWhatsapp(),
  };
}

/** Logo nuevo de WhatsApp. Recorta el margen transparente para que ocupe el mismo cuadrado que el ícono de Instagram. */
async function dataUrlLogoWhatsapp(): Promise<string> {
  const img = new Image();
  img.src = logoWhatsapp.src;
  await img.decode();
  const origen = document.createElement("canvas");
  origen.width = img.naturalWidth;
  origen.height = img.naturalHeight;
  const ctx = origen.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar el logo de WhatsApp.");
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, origen.width, origen.height);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) <= 8) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const recorteAncho = Math.max(1, maxX - minX + 1);
  const recorteAlto = Math.max(1, maxY - minY + 1);
  const salida = document.createElement("canvas");
  salida.width = recorteAncho;
  salida.height = recorteAlto;
  const ctxSalida = salida.getContext("2d");
  if (!ctxSalida) throw new Error("No se pudo preparar el logo de WhatsApp.");
  ctxSalida.drawImage(
    origen,
    minX,
    minY,
    recorteAncho,
    recorteAlto,
    0,
    0,
    recorteAncho,
    recorteAlto
  );
  return salida.toDataURL("image/png");
}
