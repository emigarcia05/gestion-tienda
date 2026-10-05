import { NextResponse } from "next/server";
import type { z } from "zod";
import { firstZodErrorMessage } from "@/lib/actionResult";
import type { ServiceResult } from "@/types";

export type ApiJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; supportId?: string };

/** Lee y valida el body JSON; devuelve la respuesta 400 si falla. */
export async function parseJsonBody<S extends z.ZodType>(
  req: Request,
  schema: S
): Promise<{ data: z.infer<S> } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      response: NextResponse.json(
        { ok: false as const, error: "Cuerpo JSON inválido." },
        { status: 400 }
      ),
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        { ok: false as const, error: firstZodErrorMessage(parsed.error) },
        { status: 400 }
      ),
    };
  }
  return { data: parsed.data };
}

/** `ServiceResult` → JSON `{ ok, data | error }` (errores de negocio con 200). */
export function jsonDesdeServicio<T>(res: ServiceResult<T>): NextResponse {
  if (!res.success) {
    return NextResponse.json({ ok: false as const, error: res.error });
  }
  return NextResponse.json({ ok: true as const, data: res.data });
}

/** 500 con `supportId` para cruzar con los logs de Vercel. */
export function jsonErrorInterno(tag: string, e: unknown, mensaje: string): NextResponse {
  const supportId = crypto.randomUUID();
  console.error(tag, supportId, e instanceof Error ? e.message : String(e));
  return NextResponse.json(
    { ok: false as const, error: `${mensaje} (ref. ${supportId}).`, supportId },
    { status: 500, headers: { "x-support-id": supportId } }
  );
}
