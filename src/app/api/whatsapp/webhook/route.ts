import { NextResponse } from "next/server";
import { leerWhatsappWebhookEnv } from "@/lib/whatsapp/env";
import {
  firmaWebhookWhatsappValida,
  verifyTokenWhatsappValido,
} from "@/lib/whatsapp/firmaWebhook";
import { webhookWhatsappPruebaSchema } from "@/lib/validations/whatsappWebhook";
import { procesarWebhookWhatsappPrueba } from "@/services/whatsappPrueba.service";

export const runtime = "nodejs";

/** Meta verifica la URL con el mismo texto guardado en WHATSAPP_VERIFY_TOKEN. */
export async function GET(request: Request) {
  const cfg = leerWhatsappWebhookEnv();
  if ("error" in cfg) return new NextResponse("forbidden", { status: 403 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  if (mode === "subscribe" && verifyTokenWhatsappValido(token, cfg.verifyToken)) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/** Avisos de mensajes y de entrega. Exige X-Hub-Signature-256. */
export async function POST(request: Request) {
  const cfg = leerWhatsappWebhookEnv();
  if ("error" in cfg) {
    console.error("[whatsapp][webhook] config");
    return new NextResponse("error", { status: 500 });
  }

  const crudo = await request.text();
  if (!firmaWebhookWhatsappValida(crudo, request.headers.get("x-hub-signature-256"), cfg.appSecret)) {
    return new NextResponse("forbidden", { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(crudo) as unknown;
  } catch {
    return new NextResponse("bad", { status: 400 });
  }

  const parsed = webhookWhatsappPruebaSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[whatsapp][webhook] forma");
    return new NextResponse("ok", { status: 200 });
  }

  const out = await procesarWebhookWhatsappPrueba(parsed.data);
  if (!out.success) return new NextResponse("error", { status: 500 });
  return new NextResponse("ok", { status: 200 });
}
