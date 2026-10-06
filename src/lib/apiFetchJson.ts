export type ApiFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

function esPayloadApi(v: unknown): v is { ok: boolean; data?: unknown; error?: unknown } {
  return v !== null && typeof v === "object" && "ok" in v && typeof v.ok === "boolean";
}

/**
 * `fetch` a Route Handlers JSON `{ ok, data | error }` (patrón Stock).
 * Nunca lanza: errores de red / HTTP vuelven como `{ ok: false, error, status }`
 * (`status` 0 = sin conexión).
 */
export async function fetchApiJson<T>(
  url: string,
  init?: { method?: "GET" | "POST" | "PUT"; body?: unknown }
): Promise<ApiFetchResult<T>> {
  try {
    const response = await fetch(url, {
      method: init?.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (esPayloadApi(payload) && payload.ok === true) {
      return { ok: true, data: payload.data as T };
    }
    const error =
      esPayloadApi(payload) && typeof payload.error === "string"
        ? payload.error
        : `Error ${response.status} del servidor.`;
    return { ok: false, error, status: response.status };
  } catch {
    return { ok: false, error: "Sin conexión con el servidor.", status: 0 };
  }
}
