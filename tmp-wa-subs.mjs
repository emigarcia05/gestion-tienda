import "dotenv/config";

function limpiar(texto) {
  return String(texto ?? "")
    .replace(/EAA[A-Za-z0-9]+/g, "[token]")
    .slice(0, 300);
}

const version = (process.env.WHATSAPP_GRAPH_VERSION ?? "").trim();
const token = (process.env.WHATSAPP_ACCESS_TOKEN ?? "").trim();
const secret = (process.env.WHATSAPP_APP_SECRET ?? "").trim();
const appId = "1433282181105532";
const waba = "1113386101313193";

if (!/^v\d+\.\d+$/.test(version) || !token || !/^[a-f0-9]{32}$/i.test(secret)) {
  console.log(JSON.stringify({ listo: false, motivo: "entorno-incompleto" }));
  process.exit(0);
}

async function graph(path, access) {
  const res = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const json = await res.json();
  return { status: res.status, json };
}

const phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID ?? "").trim();
const subs = await graph(`${appId}/subscriptions`, `${appId}|${secret}`);
const apps = await graph(`${waba}/subscribed_apps`, token);
const phone = /^\d{8,20}$/.test(phoneId)
  ? await graph(`${phoneId}?fields=webhook_configuration`, token)
  : { status: 0, json: { error: { code: 0, message: "phone-id-invalido" } } };

const callbacks = (subs.json?.data ?? []).map((item) => ({
  object: item.object ?? null,
  callback_url: item.callback_url ?? null,
  active: item.active ?? null,
  fields: (item.fields ?? []).map((f) => (typeof f === "string" ? f : f.name)),
}));

const suscritas = (apps.json?.data ?? []).map((item) => ({
  id: item.whatsapp_business_api_data?.id ?? item.id ?? null,
  name: item.whatsapp_business_api_data?.name ?? null,
  override_callback_uri: item.override_callback_uri ?? null,
}));

console.log(
  JSON.stringify(
    {
      subsStatus: subs.status,
      callbacks,
      subsError: subs.json?.error
        ? { code: subs.json.error.code, sub: subs.json.error.error_subcode ?? null, msg: limpiar(subs.json.error.message) }
        : null,
      wabaStatus: apps.status,
      suscritas,
      wabaError: apps.json?.error
        ? { code: apps.json.error.code, sub: apps.json.error.error_subcode ?? null, msg: limpiar(apps.json.error.message) }
        : null,
      phoneStatus: phone.status,
      webhookConfiguration: phone.json?.webhook_configuration ?? null,
      phoneError: phone.json?.error
        ? { code: phone.json.error.code, sub: phone.json.error.error_subcode ?? null, msg: limpiar(phone.json.error.message) }
        : null,
    },
    null,
    2
  )
);
