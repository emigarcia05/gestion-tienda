# OPENIA — API de OpenAI

Guía de la integración con la API oficial de OpenAI. El prefijo de las variables es `OPENIA_`. No se renombra a `OPENAI_` ni a `WHATSAPP_`.

**No leas este archivo entero si solo tocás una pantalla.** La tabla de abajo dice qué sección alcanza. El comportamiento de cada pantalla sigue en la guía de backend: WhatsApp prueba en **§3.17** y Consulta Técnica en **§3.18**.

La fuente de verdad del comportamiento es el código de este repo. La fuente de verdad del modelo vigente, del precio y de los campos del request es la documentación oficial de OpenAI. Si el default del código figura dado de baja, hay que decirlo antes de dejarlo como default.

Esto no es el asesor de colores. IA Diseño carga un CSV a un GPT propio y no llama a esta API. Esa guía es `docs/AGENTEIA_GUIDELINES.md`.

| Qué estás haciendo | Leer |
|--------------------|------|
| Clave, modelo, URL o el `fetch` | **Cliente** + **Variables** |
| Borrador del chat de WhatsApp | **Sugerencia de WhatsApp** + `docs/BACKEND_GUIDELINES.md` **§3.17** |
| Instructivo o charla de Consulta Técnica | **Consulta Técnica** + `docs/BACKEND_GUIDELINES.md` **§3.18** |
| Pantalla | `docs/FRONTEND_GUIDELINES.md` (WhatsApp · Prueba o Ventas · Consulta Técnica) |

---

## Qué hace

Hay un solo cliente HTTP, sin SDK de OpenAI y sin Prisma. Vive en `src/lib/whatsapp/ia/`. `env.ts` y `completar.ts` importan `server-only`. Ningún componente cliente llama a la API.

Dos pantallas lo usan:

1. **WhatsApp prueba** (`/administrador/whatsapp/prueba`). El botón **Respuesta de Sugerencia** pide un borrador. El vendedor lo lee, lo edita, lo manda con **Enviar Prueba** o lo descarta. El borrador no se envía solo y esa llamada no habla con Meta.
2. **Consulta Técnica** (`/ventas/ventas/consulta-tecnica`). Resume la hoja del fabricante y, con el hilo abierto, responde como especialista de mostrador. La foto del hilo no se manda al modelo.

---

## Variables

Las tres van vacías en `.env.example`. En el sitio publicado viven en Vercel. `.env` no se commitea. La clave no se loguea, no vuelve al cliente y no se escribe en las guías.

| Variable | Vacía | Uso |
|----------|--------|-----|
| `OPENIA_API_KEY` | El botón y la consulta avisan que falta | `Authorization: Bearer` |
| `OPENIA_MODELO` | `gpt-5-nano` (`OPENIA_MODELO_DEFAULT`) | Campo `model` de los dos endpoints |
| `OPENIA_BASE_URL` | `https://api.openai.com/v1` | Host, sin barra final |

`leerWhatsappIaEnv` (`src/lib/whatsapp/ia/env.ts`) es la única lectura. Rechaza un modelo que no matchee `^[a-zA-Z0-9._:-]{1,64}$` y una URL que no sea `https`. `gpt-4.1-nano` ya no está en la API y no vuelve como default.

La API se cobra por uso, aparte de una suscripción de ChatGPT. Precios y modelos: [pricing](https://developers.openai.com/api/docs/pricing) y la página del modelo. No pegar la clave en el chat, en un log ni en una guía.

---

## Cliente

`src/lib/whatsapp/ia/completar.ts`. Un `fetch` por pedido. Timeout de chat: 45 s. Timeout de búsqueda: 30 s. TLS queda activo.

| Función | Endpoint | Tope de salida | Razonamiento |
|---------|----------|----------------|--------------|
| `completarWhatsappIa` | `POST {base}/chat/completions` | 120 tokens (`WHATSAPP_IA_MAX_TOKENS_SALIDA`) | `reasoning_effort: minimal` |
| `completarConsultaTecnica` | el mismo | 1000 tokens; si el texto vuelve vacío, reintenta con 1500 y sin razonamiento mínimo | igual |
| `buscarFuentesConsultaTecnica` | `POST {base}/responses` | `max_output_tokens: 800` | `reasoning.effort: low` |

`gpt-5-nano` gasta el tope en razonar si el pedido no pide `reasoning_effort: minimal`, y el texto vuelve vacío. `web_search` no admite `minimal`: la búsqueda va en `low`.

Si chat completions responde 400 y el cuerpo nombra `reasoning_effort` o `max_completion_tokens`, se reintenta una vez sin ese campo (el tope pasa a `max_tokens`). No se reintenta otro error.

El texto de la respuesta puede venir como string o como lista de partes con `text`. Si no hay texto usable, el servicio dice «El modelo no devolvió un texto.»

Errores HTTP, sin devolver el cuerpo ni la clave:

| Estado | Mensaje |
|--------|---------|
| 401 o 403 | La clave del modelo no fue aceptada. |
| 429 | El modelo está ocupado. Probá de nuevo en un momento. |
| otro, o red | No se pudo redactar la sugerencia. / No se pudo conectar con el modelo. / No se pudo buscar la ficha del fabricante. |

El log de servidor lleva el prefijo `[whatsappIa]` o `[consultaTecnica]` y, como mucho, el nombre del error o el status. No el cuerpo crudo.

`buscarFuentesConsultaTecnica` pide la herramienta `web_search` con `user_location` aproximada en `AR` e `include: ["web_search_call.action.sources"]`. Devuelve solo URLs `https` que vinieron en `output[].action.sources`. Una URL que el modelo redacte en el texto no entra.

No abrir un segundo cliente HTTP. La Action no arma el JSON ni lee la clave.

---

## Sugerencia de WhatsApp

Servicio `sugerirRespuestaWhatsappIa` (`src/services/whatsappIa.service.ts`). Action `sugerirRespuestaWhatsappIaAction` (`src/actions/whatsappPrueba.ts`): gate `requireEditorWhatsappPrueba`, payload `unknown` + `sugerirRespuestaWhatsappIaSchema`, `ActionResult` con el texto. `revalidatePath` de `APP_ROUTES.administrador.whatsapp.prueba`.

El botón aparece cuando el último mensaje del chat abierto es entrante. El borrador entra en el cuadro **MENSAJE**. Un aviso pide revisarlo. **Descartar** vuelve al texto anterior. **Enviar Prueba** sigue en `enviarTextoWhatsappPruebaAction`. Cambiar de chat limpia el cuadro.

Armado del pedido: `src/lib/whatsapp/ia/armado.ts` (funciones puras; no habla con la API).

Entran los últimos 10 mensajes del chat (`+54` y `+549` del mismo móvil, o el hilo del BSUID), cada uno recortado a 500 caracteres. No se manda el catálogo.

Hechos, y nada más:

| Origen | Cuándo | Tope |
|--------|--------|------|
| Nota | `whatsapp_ia_contexto` activo: alcance `NEGOCIO` (`telefono` null) o `CHAT` de ese teléfono | 8 |
| Producto | El cliente nombra algo. Hasta 6 ítems habilitados de `prod_lista` cuya descripción contiene esas palabras | 6 |
| Sucursal | Solo si la consulta habla del local (horario, dirección, teléfono) | las sucursales que no son corporativo |

El precio es el de la lista **1 - GENERAL** (`prod_lista_precios`). Sin fila, el hecho dice que no hay precio. El stock es el saldo de `stock_movimientos` por sucursal, sin corporativo. La pantalla para cargar notas todavía no existe: la tabla ya se lee. CHECK `whatsapp_ia_contexto_alcance_chk`. Las fichas de Consulta Técnica no entran en este pedido.

El system pide español de Argentina, una o dos oraciones, sin markdown ni emojis, y `[COMPLETAR]` si falta un dato. Prohibido inventar precios, stock, medidas, rendimientos o datos técnicos.

`cerrarBorradorSugerencia` saca bloques de código, reemplaza por `[COMPLETAR]` un importe o un número que no esté en los hechos, y corta en 400 caracteres.

Cada borrador se guarda en `whatsapp_ia_sugerencias` (`WhatsappIaSugerencia`): teléfono, texto, modelo, `tokens_entrada`, `tokens_salida`, `tokens_total` y `mensaje_ancla_id` (el último entrante, sin FK). Migración `20261121140000_whatsapp_ia_sugerencias` (también crea `whatsapp_ia_contexto`).

Topes en `src/lib/whatsapp/ia/limites.ts`: 10 mensajes, 500 caracteres por mensaje, 400 en el borrador, 120 tokens, 6 productos, 8 notas.

---

## Consulta Técnica

El mismo cliente. La lógica de negocio está en `consultaTecnica.service.ts` y `consultaTecnicaInstructivo.service.ts`. Permiso `PERMISOS.consultaTecnica.acceso` (`simple` y `editor`). La página exporta `maxDuration` 60 porque lee la hoja del fabricante.

### Cómo usar un producto

En la pantalla el hilo `FICHA_ITEM` se llama **Cómo usar un producto**. `resumirHojaFabricante`. El texto es el mismo para cualquier ítem. No hay reglas por producto.

1. Si la familia tiene PDF o URL cargados, se lee eso y no se busca en la web.
2. Si no hay ficha, o no se puede leer (menos de 200 caracteres), `buscarFuentesConsultaTecnica` pide la hoja oficial en Argentina.
3. `elegirFuenteOficial` (`src/lib/consultaTecnicaFuentes.ts`) se queda con las URLs de esa búsqueda, prioriza `arg.` y descarta tiendas y redes (Mercado Libre, YouTube, Instagram, Facebook, TikTok, Pinterest, Wikipedia, Scribd, sikaguia).
4. Se lee el PDF oficial (hasta 3 páginas, 7000 caracteres) y, si no se puede, el HTML.
5. `completarConsultaTecnica` pide un JSON con `preparacion` y `aplicacion`. Un dato que la hoja no trae no se escribe: `dejarSeccionSiEstaEnFuente` tira un número que no está en la hoja. Si `aplicacion` habla de diluir y no trae `%` ni dice que va pura, queda en `[COMPLETAR]` y no se muestra.

El usuario ve un paso a paso. **1. Preparación.** dice cómo tiene que estar la superficie. Si la hoja no dice lo contrario, esa frase es que esté limpia, sin polvo, sin grasa y seca, y suma el requisito extra que la hoja escriba. El paso siguiente es un solo párrafo, en palabras de todos los días y en orden de uso: batir si la hoja lo pide, cada mano con su dilución, la espera y el clima u otra condición. El modelo elige esas frases según la hoja. No hay un texto fijo de dilución ni de tiempos por producto. La ficha técnica queda en la URL. El párrafo se guarda partido en `dilucion`, `secado_entre_manos` y `secado_final` (esas columnas ya existían). La marca `v3|` en `preparacion` distingue este formato. Una ficha guardada con `v2|` se vuelve a leer.

La memoria es `consulta_tecnica_fichas`. La clave es `FLIA {id}` de `prod_familias`: los SKU de la misma familia comparten la hoja. Sin familia, `ITEM {cod_tienda}`. Se reusa 30 días. `prod_lista` no se fusiona: cada SKU conserva precio y stock. Migración `20261124190000_consulta_tecnica_fichas_compartidas`.

`consulta_tecnica_recomendaciones` (uso, dilución, aplicación y rendimiento por marca y rubro) es otra tabla. Esta pantalla no la edita y la sugerencia de WhatsApp no la lee.

### Charla del hilo

`conversarConsultaTecnica`, Action `conversarConsultaTecnicaAction`. Guarda el texto del usuario y responde en el mismo hilo.

Si el mensaje nombra un producto y no es un seguimiento, primero se buscan familias habilitadas por nombre y, si no hay, ítems de `prod_lista`. Dos o más coincidencias: la respuesta pregunta cuál es y guarda botones, sin llamar al modelo. Una sola: responde con el instructivo. Ninguna: sigue el agente. Si el hilo ya tiene el paso a paso, la respuesta sigue ese tono y no lo vuelve a armar.

El pedido de chat lleva los últimos 8 mensajes, la hoja del ítem si ya está o si se puede leer, y hasta 5 ítems de `prod_lista` más hasta 5 de `proveedores_prod_lista`. El orden para recomendar es tienda, después proveedor, y solo al final un producto que no esté en esas listas. No inventa precios ni stock. Sin ficha, el criterio de mostrador no se presenta como ficha oficial.

Una línea del modelo que trae `[COMPLETAR]` se descarta (`textoSinCompletar`). El system de la charla pide no escribir `[COMPLETAR]`: si la pregunta llega cortada, se pide completarla. Si el modelo no contesta, el motivo queda escrito en el hilo.

Los textos van en `consulta_tecnica_mensajes` (hasta 2000 caracteres). Esta llamada no guarda tokens: el consumo de tokens se persiste solo en `whatsapp_ia_sugerencias`.

---

## Al cambiar esto

1. Leer esta guía y el § de la pantalla (`§3.17` o `§3.18`).
2. Contrato Zod y tipos antes de la UI. La Action no arma el JSON de OpenAI.
3. Un cambio de default de modelo, de proveedor, de mandar el catálogo entero, de una pantalla para las notas o de una dependencia nueva se pregunta antes.
4. Cerrar con esta guía si cambió el cliente o las variables, con **§3.17** / **§3.18** si cambió el contrato de la pantalla, y con la clave nueva vacía en `.env.example`.
5. `npx eslint src --max-warnings 0`.

Prohibido: llamar a OpenAI desde un componente cliente; un segundo cliente HTTP; volver a `gpt-4.1-nano` o a un modelo dado de baja; mandar `prod_lista`, stock o sucursales enteros; sacar `reasoning_effort: minimal` en `gpt-5-nano` sin un reemplazo que deje el texto visible dentro del tope; razonamiento `minimal` en `web_search`; desactivar TLS; `any`; commitear `.env` o una clave; enviar el WhatsApp como efecto de generar la sugerencia.
