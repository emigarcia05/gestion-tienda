import logoConFondo from "../../fuentes_logos/logo_tiendacolor_con_fondo.jpg";
import { formatDdMmHhMmGuionesBajosArchivoArgentina } from "@/lib/fechaArgentina";
import { descargarPdfBytes } from "@/lib/descargarPdfBase64";
import {
  componerImagenConMuestra,
  generarPdfAproximacionCodigoImagen,
  type InformeAproximacionCodigoImagen,
  type LogoTiendaColorPdf,
} from "@/lib/generarPdfAproximacionCodigoImagen";

async function cargarLogoTiendaColor(): Promise<LogoTiendaColorPdf | null> {
  try {
    const res = await fetch(logoConFondo.src);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("No se pudo leer el logo."));
      reader.readAsDataURL(blob);
    });
    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () =>
        resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error("Logo inválido."));
      img.src = dataUrl;
    });
    return {
      dataUrl,
      naturalW: size.w,
      naturalH: size.h,
    };
  } catch {
    return null;
  }
}

/** Compone imagen anotada, genera PDF y lo descarga en el navegador. */
export async function descargarPdfAproximacionCodigoImagen(
  informe: InformeAproximacionCodigoImagen,
): Promise<void> {
  const [anotada, logo] = await Promise.all([
    componerImagenConMuestra(
      informe.imagenDataUrl,
      informe.imagenNaturalW,
      informe.imagenNaturalH,
      informe.muestra,
    ),
    cargarLogoTiendaColor(),
  ]);
  const bytes = generarPdfAproximacionCodigoImagen(informe, anotada, logo);
  const stamp = formatDdMmHhMmGuionesBajosArchivoArgentina(new Date());
  descargarPdfBytes(bytes, `Aproximacion Codigo Imagen - ${stamp}.pdf`);
}
