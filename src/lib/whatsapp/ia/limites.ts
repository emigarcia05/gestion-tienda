/** Tope de la conversación que ve el modelo. */
export const WHATSAPP_IA_MAX_MENSAJES = 10;

/** Cada mensaje se recorta antes de salir hacia el modelo. */
export const WHATSAPP_IA_MAX_CHARS_MENSAJE = 500;

/** El borrador que vuelve a la pantalla. */
export const WHATSAPP_IA_MAX_CHARS_RESPUESTA = 400;

/** Tope de salida. Un modelo liviano y una respuesta corta. */
export const WHATSAPP_IA_MAX_TOKENS_SALIDA = 120;

export const WHATSAPP_IA_MAX_PRODUCTOS = 6;

export const WHATSAPP_IA_MAX_NOTAS = 8;

/** Vacío en el entorno: este modelo. `gpt-4.1-nano` ya no está en la API. */
export const OPENIA_MODELO_DEFAULT = "gpt-5-nano";

export const OPENIA_BASE_URL_DEFAULT = "https://api.openai.com/v1";
