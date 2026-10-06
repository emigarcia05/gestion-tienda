import { prisma } from "@/lib/prisma";

/** Filas fijas de `prod_ped_ult_comp` (correlativos de comprobantes **no fiscales**). */
const ULT_COMP_ID = {
  COMPROBANTE_COMPRA: 1,
  NOTA_CREDITO: 3,
} as const;

export type TipoCorrelativoCompra = keyof typeof ULT_COMP_ID;

const RE_LETRA_BLOQUES = /^([A-Za-z])-(\d+)-(\d+)$/;
const RE_DIGITOS = /^\d+$/;
const MAX_INTENTOS = 5;

function siguienteDigitos(raw: string): string {
  const next = (BigInt(raw) + BigInt(1)).toString();
  return next.padStart(raw.length, "0");
}

/** `X-00000-00000002` → `X-00000-00000003` (carry del bloque final al medio). */
function siguienteLetraBloques(raw: string): string {
  const m = RE_LETRA_BLOQUES.exec(raw);
  if (!m) throw new Error(`Correlativo con formato no soportado: ${raw}`);
  const [, letra, midRaw, lastRaw] = m;
  const mod = BigInt(10) ** BigInt(lastRaw.length);
  let mid = BigInt(midRaw);
  let last = BigInt(lastRaw) + BigInt(1);
  if (last >= mod) {
    last -= mod;
    mid += BigInt(1);
  }
  if (mid >= BigInt(10) ** BigInt(midRaw.length)) {
    throw new Error("Se superó el correlativo máximo.");
  }
  return `${letra.toUpperCase()}-${mid.toString().padStart(midRaw.length, "0")}-${last
    .toString()
    .padStart(lastRaw.length, "0")}`;
}

export function siguienteCorrelativo(raw: string): string {
  const t = raw.trim();
  if (RE_DIGITOS.test(t)) return siguienteDigitos(t);
  return siguienteLetraBloques(t);
}

/**
 * Reserva el próximo número no fiscal (incremento optimista sobre el valor leído;
 * sin `$transaction` interactiva). Si la escritura posterior falla, el número queda consumido.
 */
export async function reservarCorrelativoCompra(tipo: TipoCorrelativoCompra): Promise<string> {
  const id = ULT_COMP_ID[tipo];
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const row = await prisma.prodPedUltComp.findUnique({
      where: { id },
      select: { ultComprobante: true },
    });
    if (!row) throw new Error(`Falta el correlativo ${tipo} en prod_ped_ult_comp.`);
    const next = siguienteCorrelativo(row.ultComprobante);
    const res = await prisma.prodPedUltComp.updateMany({
      where: { id, ultComprobante: row.ultComprobante },
      data: { ultComprobante: next },
    });
    if (res.count === 1) return next;
  }
  throw new Error("No se pudo reservar el número de comprobante. Reintentá.");
}
