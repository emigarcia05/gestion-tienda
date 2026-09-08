# Guía Backend — vigente

Stack: **Next.js 16 App Router**, **Prisma 7**, **Zod v4**, **iron-session**. Zona horaria de negocio: **Argentina (UTC−3)**.

**No leas este archivo entero.** Usá la tabla y saltá al § del dominio o principio que estás tocando.

| Qué estás haciendo | Leer |
|--------------------|------|
| Cualquier Action / API route nueva | **Guía para IA** + **§1.2** + patrón **§2.1–2.4** |
| Mutación crítica (borrar, sync, import, API externa) | **§1.2.3** (gate doble + excepciones) |
| Payload / IDs Zod | **§1.2.2** + **§1.2.4** |
| Error / `ActionResult` | **§1.5** |
| Prisma, Neon, índices | **§1.4** |
| Fecha / hora de negocio | **§1.3** |
| Proveedores / lista precios / descuentos / USD / REX | **§3.1–3.3** |
| Tienda, vínculos, Cx Compra, stock | **§3.4–3.5** |
| Px Listas DUX / Px Competencia / competencia | **§3.6** |
| Comp. Categorías | **§3.7** |
| Pedidos (urgente, enviar, reposición, historial, DUX, a fábrica) | **§3.8** |
| Finanzas (tesorería, gastos, balance, IVA, M.C.) | **§3.9** |
| Estadísticas / `est_por_prod` | **§3.10** |
| Marketing / Google Sheets | **§3.11** |
| Asistente IA | **§3.12** |
| Sync DUX / Route Handlers | **§3.13** |
| Tipos pintura / rendimientos | **§3.14** |
| Envios (Vendedor) | **§3.15** |
| Prohibido reintroducir | **§5** |
| IA Diseño / scraper / CSV | `docs/AGENTEIA_GUIDELINES.md` |

---

## Guía para IA

1. **Action** = sesión (`getRol` / `esEditor`) + permiso (`puede` / `PERMISOS`) + Zod (`unknown` + `safeParse`) + delegación a `src/services/`. Devolver `ActionResult`.
2. **Autorización primero.** Antes de parsear o tocar servicios. No confiar en que el layout protege la página.
3. **Prohibido `any`.** TypeScript estricto.
4. **Sin lógica de negocio pesada ni Prisma en Actions nuevas.** Legacy documentado en **§5** (tienda/stock/reposición/vínculos/tipos pintura): no copiar el patrón.
5. **Una sola entrada por operación.** No Action + API route duplicados. Jobs largos (import, sync DUX, scraping) = Route Handler.
6. **Mutaciones críticas:** gate doble módulo + `esEditor()`, salvo excepciones de **§1.2.3**.
7. **IDs:** `cuid` → `prismaCuidSchema`; UUID → `uuidSchema`; mixto → `prismaCuidOrUuidSchema` / `globalSucursalIdSchema`; `cod_ext` / `cod_tienda` → esquemas en `@/lib/validations/common`.
8. **Errores:** `{ ok: false, error: string }` controlado. No stack ni SQL al cliente. Loguear en servidor con prefijo `[modulo][fn]`.
9. **TZ:** `@/lib/fechaArgentina`. No `Date#getHours()` ni `toLocaleDateString` sin `timeZone`.
10. **Naming:** Px Competencia = `pxCompetencia*`. Px Listas DUX = `pxListasPrecios*`. Ver **§5**.
11. **Gates repetidos:** `@/lib/actionGates.ts` (finanzas / marketing / estadísticas / Asistente IA / gasto eventual). API: `@/lib/apiRouteAuth.ts`.
12. **Al cerrar:** actualizar este documento (modelo, servicio, regla o patrón). Lint: `npx eslint src --max-warnings 0`.

---

## 1. Principios

### 1.1 Server Actions (`src/actions/`)

- `"use server"` al inicio. Exports: **`export async function`**. **No** re-exportar valores de runtime (strings, Zod, constantes); dispara `invalid-use-server-value`. `export type` sí. Literales compartidos: `src/services/` o `src/lib/`.
- Rol: orquestadores I/O. Firma `async`, tipado estricto.
- **Anti-patrón:** una Action no llama a otra Action. Extraer al servicio.

### 1.2 Seguridad

#### 1.2.1 Sesión (`src/lib/sesion.ts`)

- **iron-session** vía `getSesion()`, `getRol()`, `esEditor()`.
- Roles: `"simple"` | `"editor"`. El editor se activa con `activarModoEditor` (`clave` Zod `z.string().min(1).max(500)` vs `EDITOR_PASSWORD`). Única Action de sesión. No hay “volver a simple”: cookie de arranque `tienda-app-arranque` (sin `maxAge`) + middleware fuerzan `simple` al reabrir el navegador. Rutas `/api/*` fuera del matcher del middleware.
- Usuario de pestaña: `sessionStorage` (`main-app-usuario-sesion`); **no** se persiste en iron-session ni BD. Sucursal preferida se copia de `global_personal.sucursal_por_defecto`. **Excepción:** Envios · Conductor no monta el slidenav; no exige usuario de pestaña (solo `PERMISOS.envios.acceso` + rol iron-session).
- `getRol()` ante cookie inválida: `"simple"` + log `[sesion][getRol]` (no tumbar el layout).

#### 1.2.2 Checklist por Action (obligatorio, en este orden)

1. **Autorización:** `getRol()` / helper de `@/lib/actionGates` / `esEditor()` + `puede(rol, PERMISOS.*)`.
2. **Payload `unknown`** desde el cliente + `.safeParse()`. Prohibido tipar la firma con `z.infer` (el cliente ignora TS). Excepción: `FormData` o un ID `string` suelto, igual con Zod interno.
3. **IDs** según modelo Prisma (**§1.2.4**).
4. **Delegar** al servicio; `revalidatePath` de rutas canónicas; devolver `ActionResult`.
5. **Sin fugas:** `try/catch` alrededor de Prisma/servicios que puedan lanzar. Lecturas con shape vacío ante error (no stack).

#### 1.2.3 Gate doble: módulo + editor

Convención: `puede(rol, PERMISOS.<modulo>…)` **antes** de `esEditor()`. El primero rechaza acceso conceptual; el segundo rechaza modo solo-lectura.

**Excepciones (simple y editor pueden mutar):**

| Área | Qué |
|------|-----|
| Historial de pedidos | Recepción, marcar registrado, eliminar cabecera, PDF, correlativo NC (`pedidosHistoria.ts`). Lectura: RSC o `GET /api/pedidos-historia/[id]/detalle`. |
| Pedido urgente / tintométrico / enviar / reposición / a fábrica | Upserts de cantidades, PDF generar pedido, reglas reposición (incluye `unidadesPorBulto` → `prod_tienda.bulto` vía `guardarBultoProdTienda`). Flujo vendedor. |
| Stock / Trans. Depósitos | Registrar y marcar transferido (`stock_trasn_depositos`); borrador de grilla en `localStorage` hasta Generar Transf.; Exportar Excel (`registrarExportacionExcelStock`) actualiza `prod_tienda_stock` del depósito de la sucursal + ÚLT. CONTROL. Flujo vendedor. |
| Sync DUX lista tienda | `PERMISOS.tienda.acciones.sincronizar` (`simple` y `editor`). Solo API, no Action. |
| Ayuda vendedor · gasto eventual | `PERMISOS.ayudaVendedor.cargarGasto` (`requireCargarGastoEventual`). |
| Envios | CRUD clientes / direcciones / envío final + PDF (`requireEnvios`). Flujo vendedor. |

**Todo lo demás crítico** (catálogos maestros, finanzas, marketing CRUD, competencia, lista precios, usuarios, import, scraping, Google Sheets): módulo + `esEditor()`.

#### 1.2.4 IDs Prisma

| Tipo | Schema | Modelos típicos |
|------|--------|-----------------|
| CUID | `prismaCuidSchema` | `Proveedor`, `PedidoHistoria`, gastos balance, tesorería, competencia, marketing, envíos |
| UUID | `uuidSchema` | `ProdPedMerc2`, `prod_rendimientos` |
| Mixto / seed | `prismaCuidOrUuidSchema`, `globalSucursalIdSchema` | sucursales (incluye literal `suc_corporativo`) |
| `cod_ext` | `listaPreciosCodExtSchema` / `listaPreciosCodExtListSchema` | `prod_precios_provee` |
| `cod_tienda` | `listaPreciosCodTiendaSchema` | `prod_tienda` |
| FK opcional reglas | `prismaIdOptionalNullableSchema` | descuentos (`""` → `null`; CUID o UUID legacy) |

`proveedorId` en filtros: `prismaCuidSchema.optional()`. No `z.string().max(128)`.

Mapas cliente→servidor con claves FK: `z.record(prismaCuidSchema, …)` + tope de cardinalidad.

#### 1.2.5 Superficie mínima y ENV

- Action sin call sites → eliminarla (`node scripts/audit-actions-usage.mjs`).
- Toda lectura `process.env.*` listada en **`.env.example`**. Obligatorios en prod: `SESSION_SECRET`, `DATABASE_URL`.
- Google Sheets: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` (normalizar `\n` con `normalizeGooglePrivateKey` en `@/lib/googleSheets.ts`), `GOOGLE_SHEETS_SPREADSHEET_ID`. Probe: servicio `probarConexionGoogleSheets` + `npm run test:google-sheets` (no hay Action de probe).

### 1.3 Integridad y zona horaria

- Todo payload que toque BD: Zod **antes** de usarse. Preferir validar en la Action; en el servicio si se reutiliza.
- **`@/lib/fechaArgentina`**: `TIMEZONE_ARGENTINA = "America/Argentina/Buenos_Aires"`. PDFs, nombres de archivo, “hoy” de negocio.
- Solo fecha calendario (`YYYY-MM-DD` sin hora, p. ej. factura DUX): parsear partes ISO (`parseIsoYmdParts`), no el TZ del runtime.

### 1.4 Arquitectura

- **Servicios** (`src/services/`): Prisma / SQL / reglas. Las Actions los invocan; no al revés.
- **Prisma / Neon:** `DATABASE_URL` = pooler (runtime `src/lib/prisma.ts`). Migraciones: `DIRECT_URL` (host sin `-pooler`) en `prisma.config.ts`.
- **URLs Gestión de Productos:** prefijo `/gestion-productos/...`. Mutaciones: revalidar la ruta canónica; se permiten rutas legacy (`/proveedores`, `/tienda`, `/stock`, `/pedidos/*`) mientras existan redirects.
- **`stockeable`:** no hay columna en `prod_tienda`. Se deriva de `prod_tienda_stock.ctd_disponible` no nulo en los depósitos de Guaymallén y Maipú (`computeStockeableDesdeStocks` / `whereProdTiendaStockeable` en `prodTiendaStock.service.ts`). IDs canónicos: `global_sucursales.id_deposito`; el parser de sync usa `DUX_ID_STOCK_*` (deben coincidir).
- **Vínculo tienda ↔ proveedor:** 100 % manual. Única relación vigente: `prod_precios_provee.cod_tienda`. Sync DUX **no** escribe `proveedor` ni auto-vincula. `prod_tienda.cod_ext` no existe.
- **`prod_tienda.bulto`:** unidades por bulto (`Int?`). `null` = vacío. CHECK SQL `prod_tienda_bulto_positivo` (`"bulto" IS NULL OR "bulto" > 0`). Sync DUX **no** escribe esta columna. Persistencia: `tiendaBultos.service.ts`. **No** reintroducir `prod_tienda_bultos` / `ProdTiendaBulto`.
- **Lotes DUX:** 50 ítems/lote (`DUX_API_BATCH_SIZE` / `DUX_API_PAGE_LIMIT`); pausa ≥ 5 s (`DUX_API_BATCH_INTERVAL_MS`). Timeout HTTP `DUX_FETCH_TIMEOUT_MS` (default 30 s) cubre fetch+JSON, no el backoff 429.

### 1.5 Errores y respuestas

```ts
// Actions — @/lib/types
type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

// Servicios — @/types (service.types)
type ServiceResult<T = void> = { success: true; data: T } | { success: false; error: string };
```

No lanzar al cliente. `sesion.ts` puede devolver `{ ok, error? }`.

**Error boundaries RSC:** `src/app/global-error.tsx` + `error.tsx` por ruta que lea Prisma. `catch` en servicios con prefijo grepeable (`[pedidoHistoria]`, `[sesion][getRol]`, etc.).

---

## 2. Patrones de código

### 2.1 Action con gate + Zod + servicio

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas } from "@/lib/actionGates";
import type { ActionResult } from "@/lib/types";
import { crearAlgoSchema } from "@/lib/validations/algo";
import { crearAlgo } from "@/services/algo.service";

export async function crearAlgoAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = crearAlgoSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      [...Object.values(flat.fieldErrors).flat(), ...flat.formErrors][0] ?? "Datos inválidos.";
    return { ok: false, error: msg };
  }

  try {
    const res = await crearAlgo(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    revalidatePath("/ruta-canonica");
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[crearAlgoAction]", e);
    return { ok: false, error: "No se pudo crear." };
  }
}
```

`FormData` (alta proveedor, etc.): armar `raw` desde `formData.get(...)` y `safeParse` igual. El gate de módulo concreto (`PERMISOS.proveedores.acciones.nuevoProveedor`) va **antes** del parse.

### 2.2 Lectura sensible (permiso + Zod + shape vacío)

```ts
export async function getPxListasPreciosPageData(params: unknown) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.cxPxTienda.acceso)) {
    return emptyPxListasPreciosPageData();
  }
  const parsed = getPxListasPreciosPageParamsSchema.safeParse(params);
  if (!parsed.success) return emptyPxListasPreciosPageData();
  return getPxListasPreciosPageDataFromDb(parsed.data);
}
```

Listados pesados de página: preferir **RSC → servicio** (sin Action) cuando el cliente no invoca la lectura. **Px Listas** carga el listado desde el RSC (`getPxListasPreciosPageDataFromDb`); la Action queda para mutaciones y para callers que no son la página. El shape vacío de permiso/Zod **no** debe ejecutar Prisma (DISTINCT / count).

### 2.3 Zod típico

Esquemas en `src/lib/validations/<dominio>.ts`. Comunes en `@/lib/validations/common`.

### 2.4 Helpers de gate

| Helper | Dónde |
|--------|--------|
| `requireEditorFinanzas` / `requireFinanzasLectura` / `requireCargarGastoEventual` | `@/lib/actionGates.ts` |
| `requireEditorMarketing` / `requireMarketingLectura` | idem |
| `requireEditorEstadisticas` / `requireEstadisticasLectura` | idem |
| `requireEditorAsistenteIa` / `requireAsistenteIaLectura` | idem |
| `guardTiendaListaPreciosSincronizar`, `guardFinanzasLectura`, `guardFinanzasEditor`, `guardCompetenciaPreciosSyncEsEditor`, `guardListaPreciosImportarEsEditor`, `guardEstPorProdImportarEsEditor`, `guardPedidosLectura`, `guardIndicadorSlidenavLectura` | `@/lib/apiRouteAuth.ts` |

GET de estado y POST del mismo job: **mismo guard**.

---

## 3. Dominios

### 3.1 Proveedores y personal

**`global_proveedores`** (`Proveedor`): `id` cuid. `id_proveedor_dux` único (varios `NULL` OK; valor no nulo único). FK referenciada por `fin_compras_comprobante.id_proveedor` (`onDelete: Restrict`).

| Campo | Regla |
|-------|--------|
| `proveedor_mercaderia` | Default alta `false`; UI mercadería default SI. Filtros `/gestion-productos/*` → solo `true`. `getProveedoresMercaderia` / `getProveedoresNoMercaderia` / `getProveedores`. |
| `es_fabrica` | Opt-in. Pedido A Fáb. + retención historial 60/14 días. |
| `tiempo_entrega_en_dias` | Integer nullable 0–999. |
| `coeficiente_tintometrico` | `> 0`, hasta 6 decimales. Edición masiva: `actualizarCoeficientesTintometricosAction` (`stock.acceso` + editor). |
| `plazo_pago_1_dias` … `plazo_pago_4_dias` | Plan de pago (días). 1.º obligatorio en UI (default cálculo 30). 2–4 opcionales, crecientes. Valores 30–150. Cuotas iguales sobre total; pagos FIFO. |
| `iva` | Enum `IvaProveedor`: `SIEMPRE` \| `NUNCA` \| `PREGUNTA` (default). Transversal (también `fin_bal_gasto_final.iva`). Zod: `@/lib/validations/iva.ts`. |
| `prefijo` | Opcional; 3 letras A-Z o `null`. |

CRUD: `src/actions/proveedores.ts` + `proveedor.service.ts`. Mutaciones: `PERMISOS.proveedores.acciones.nuevoProveedor`. Lectura catálogo: al menos uno de `sugeridos` / `lista` / `importarLista`. Eliminar: servicio `deleteProveedor` (`ServiceResult`; respeta FK).

**`global_personal`:** PK `id_personal` (ID DUX). `sucursal_por_defecto` + `modulos_permitidos`. Login slidenav: `listUsuariosParaInicioSesionAction` (`usuarios.inicioSesion`). Update: `actualizarUsuarioPersonalAction` (`usuarios.acceso` + editor). Lista catálogo (Usuarios): `listGlobalPersonal` en RSC. Recepción DUX usa el `idPersonal` del usuario slidenav (`leerUsuarioSesion`); no hay modal **Elegir Personal**.

### 3.2 Lista de precios proveedor

Tabla `prod_precios_provee` (`ListaPrecioProveedor`). PK `cod_ext`. `px_compra_final_sin_iva` es columna **GENERATED**.

- Lectura: `getListaPreciosConOpcionesAction` — `PERMISOS.proveedores.listaPrecios` o `sugeridos` si `opciones.soloPxSugerido`. Filtros: `listaPreciosFiltrosLecturaSchema`. Mapear siempre `px_vta_sugerido` → `pxVtaSugerido`.
- Edición masiva **fila / SET** (lápiz de fila): `actualizarListaPreciosMasivoAction` + `actualizacionMasivaListaPreciosSchema` (`edicionMasiva`). Acepta `{ ids, data }` o `{ filtros, data }` (todos los ítems del filtro, sin paginación). **No** acepta `dto_*` ni `cx_transporte` (caché del motor de reglas). **Sí** acepta `pxPromoFijo` (moneda del ítem o `null`).
- Edición masiva **variación** (botón header): `aplicarVariacionPxListaMasivaAction` + `aplicarVariacionPxListaMasivaSchema` (`edicionMasiva` + `esEditor()`). Payload: `proveedorId` (obligatorio), `marcaNombre` / `rubroNombre` (opcionales; rubro exige marca), `variacion` (± %, 2 dec., ≠ 0, tope ±99,99). Aplica `px_lista_proveedor * (1 + variacion/100)` con piso 0 (`GREATEST(..., 0)`). Preview: `contarProductosVariacionPxListaAction` + `variacionPxListaMasivaFiltrosSchema`. `px_compra_final_sin_iva` se recalcula (GENERATED).
- Import: **solo** `POST /api/import-lista-precios` (`guardListaPreciosImportarEsEditor` + `importarListaPreciosProveedorSchema`). Status: mismo guard; sin permiso → 200 + idle (no 403 de poll).
- PDF matriz → REX: `POST /api/parse-lista-precios-pdf` + `guardarPreciosRexDesdePdfAction`.

**Descuentos dimensionales** (`prod_precios_provee_reglas`): los seis `dto_*` / `cx_transporte` son caché escrita **solo** por el motor (`descuentosListaPrecioReglas.service.ts`). Gana mayor especificidad (AND proveedor/marca/rubro). Anti-empate al guardar. Post-deploy: `npm run db:recalc-descuentos-lista-precio`. Actions: `gestionarReglasDescuentos` + editor. Rubros UI: distinct `prod_tienda.rubro` (`rubrosProdTienda.service.ts`).

**Desc. específico** (`desc_especial`): reglas por producto (`cod_ext` UNIQUE en puente). Suma al `dtoTotal` de la columna generated. `descEspecialReglas.service.ts` + mismo gate de reglas.

**Px Promo Fijo** (`px_promo_fijo`): nullable por ítem (`cod_ext`), **misma moneda que la lista** (`px_dolares`: US$ o pesos). Si hay valor, `px_compra_final_sin_iva` = `px_promo_fijo × (cotizacion_dolar si px_dolares, si no 1) × (1 + cx_transporte/100)` (ignora `dto_*`, `desc_especial` y Dto. extra de Comp. Categorías). Las reglas % siguen materializadas; al poner `null` vuelve la fórmula de descuentos. Alta/baja: modal **Descuentos Aplicados** (`actualizarListaPreciosMasivo`, campo `pxPromoFijo`). No se escribe cotización al setear promo. Update de cotización solo a filas `px_dolares = true`.

**USD:** singleton `global_cotizacion_usd` id `USD`. No se edita por ítem. `cotizacionUsd.service.ts`. `COTIZACION_DOLAR` solo fallback si no hay fila.

**REX** (`prod_precios_rex`): UNIQUE `(id_proveedor, descripcion)`. Vínculo N:1 desde lista (`id_precio_rex`). Al vincular o upsert PDF se copia `px_lista_proveedor`. Gate import/edición masiva + editor.

### 3.3 Cx Compra, vínculos, costo

URL: `/gestion-productos/tienda/comp-proveedores`. Permiso lectura/edición CX: `PERMISOS.tienda.acceso` / `cxPxTienda.acceso` (solo editor).

- `getTiendaPageData` (Action con Prisma legacy): filtros `q`, rubro, marca, `proveedor` (CUID = PROV. VINC. habilitado), `cxCompra` (CUID = CX PROD. de ese proveedor), `vinculado`.
- Vínculos: `vinculos.ts` — lecturas `tienda.acceso`; `vincularProducto` / `desvincularProducto` + `esEditor()`. Ítem tienda: `listaPreciosCodTiendaSchema`; línea lista: `listaPreciosCodExtSchema`.
- **CX PROD.:** `costo_compra_cod_ext` FK a `cod_ext`. Resolución: `mapCxProdDesdeCandidatos` (`cxPxTiendaRows.service.ts`) — FK persistida → único candidato → promedio de vínculos (`CX_PROD_SELECCION_PROM`) / espejo DUX `costo_compra`. `guardarCostoCxProdTiendaAction` (`cxPxTienda.acceso` + editor).
- **BULTO** (`prod_tienda.bulto`): columna en la misma fila de tienda. `null` = vacío. Entero ≥ 1; CHECK SQL `prod_tienda_bulto_positivo`. `null` en Action deja la columna vacía. Lectura Cx Compra: `getTiendaPageData` lee `r.bulto` (`bultoProdTiendaValido`). Reposición: `getReposicionData` incluye `bulto`. Pedido A Fáb.: join `prod_precios_provee.cod_tienda` → `prod_tienda.bulto` (sin vínculo = vacío). Mutación Cx Compra: `guardarBultoTiendaAction` (`tienda.acceso` + `esEditor()`). Mutación Reposición: `upsertReglaReposicion` (`pedidos.acceso`, sin `esEditor`) llama `guardarBultoProdTienda` si FORMA PEDIR = `POR_BULTO` y viene `unidadesPorBulto` (principal y adicionales del mismo Guardar); **no** usar `guardarBultoTiendaAction` desde ese modal. En reposición, `cantPedirReposicionMerc2` usa `bulto` para `POR_BULTO`: `cantConf` (BULTOS REPOSICIÓN) × unidades de `prod_tienda.bulto`. Sin bulto válido (≥ 1) la cantidad a pedir es 0. Sync DUX **no** escribe `bulto`. Helper `buildMapBultosProdTienda` cuando no se trae la fila de tienda.
- `prod_tienda.proveedor`: espejo DUX **congelado** (sync no escribe). Match histórico en `costoListaTienda.service.ts`.
- Producto propio: `es_producto_propio`; no marcar si hay vínculos; `vincularProducto` rechaza si propio.
- **Act. Cx.:** `exportarCostoCxDiffAction` — Excel CODIGO+COSTO para import manual DUX (sin POST ítem). El botón abre `DUX_NUEVO_IMPORTADOR_URL` (`src/lib/duxImportador.ts`) en pestaña nueva.

### 3.4 Stock y transferencias

- Stock por depósito: `prod_tienda_stock` PK `(cod_tienda, id_deposito)`. Catálogo `global_depositos` (ex `prod_depositos_dux`). Cada sucursal tiene a lo sumo un depósito: `global_sucursales.id_deposito` FK UNIQUE opcional (`Restrict`; corporativo = null). Lecturas: `prodTiendaStock.service.ts` (`obtenerIdDepositoPorCodigoSucursal`). No reintroducir `global_sucursales.deposito` (texto).
- Control stock / transf.: Actions en `stock.ts` (Prisma legacy en lecturas). Permiso `stock.acceso` (simple+editor). **Exportar Excel** (`registrarExportacionExcelStock` + `registrarControlStockExportacion`): ÚLT. CONTROL (`prod_tienda.ultima_exportacion_excel`) y, para ítems con variación, `prod_tienda_stock.stock_real` / `ctd_disponible` **solo** del depósito de la sucursal del filtro (`obtenerIdDepositoPorCodigoSucursal`). No escribe DUX ni el depósito de la otra sucursal. Zod `registrarControlStockExportacionSchema`.
- **`stock_trasn_depositos`:** ledger de la transferencia (`cod_tienda` → `prod_tienda`; `cant`; `suc_origen` / `suc_destino` → `global_sucursales.id`). **Borrador de grilla:** `localStorage` `transf-depositos-borrador-v1:{origen}:{destino}` (`leerBorradorTransfDepositos` / `guardarBorradorTransfDepositos`) hasta **Transferido**; no escribe esta tabla. Si el local está vacío, `getTransfDepositos` hidrata con `listarPendientesTransfDepositosPorCodigos`. **Generar Transf.** (`registrarTransferenciasDepositos`) **reemplaza** el lote del par (deleteMany + createMany; no duplica) y abre el modal **sin** borrar el borrador. Modal: **SUC. ORIGEN** = sucursal del usuario; **SUC. DESTINO** = `global_sucursales` distintas con `id_deposito` (`listarSucursalesTransfDepositos.tieneDeposito`); si la página ya tiene destino, se precarga y `listarPendientesTransfDepositos` llena la tabla (reabrir sin Transferido = mismos ítems). Elegir destino a mano (o click Generar Transf. con destino de página) abre DUX `transferenciaDep.faces` (`enfocarDuxTransferenciaDepositosTab`, pestaña `DUX_TRANSFERENCIA_DEPOSITOS_WINDOW_NAME`; no hay botón Comenzar Transferencia). Tabla Control de ítem / COD. TIENDA (**OK** a la izquierda, copia `cod_tienda`) / DESCRIPCIÓN / CANTIDAD (copiar a la derecha, entero); cada copiar y OK enfoca la pestaña DUX ya abierta sin recargar. **Transferido** borra el lote origen→destino (`marcarTransferidoTransfDepositos`) y el borrador de grilla cuando todos los ítems tienen OK. CHECK `cant > 0` y sucursales distintas. Destino sin depósito se rechaza. Borrar producto cascada; borrar sucursal restringido. Ventana historial/duplicado **14 días**. No mueve stock DUX. **No** hay Excel de transferencia. Indicador slidenav: `GET /api/indicador-slidenav` (`hayTransfOrigen` si la sucursal es `suc_origen`).

### 3.5 Px Listas DUX y Px Competencia

**Px Listas** (precios venta DUX): `prod_tienda` + `prod_tienda_listas_precios` + `prod_tienda_precios`. Staging `prod_tienda_precios_edicion`. Actions `pxListasPrecios.ts` (`cxPxTienda.acceso`). CATEGORÍA MARGEN: `fin_ana_mc_cat` + lista `1 - GENERAL`. Competidor ref. GENERAL: `prod_tienda.competencia_id_px_lista_general`. `guardarPrecioListaEdicionDesdePx` persiste PX aunque `costoCompra` sea 0 (`margenManual` null). `guardarPrecioListaEdicionDesdeMargen` exige costo > 0 (sin costo no hay PX). Act. Px: `exportarPxListasMargenAction` (Excel + limpia staging; sin POST ítem a DUX). El botón abre `DUX_NUEVO_IMPORTADOR_URL` (`src/lib/duxImportador.ts`) en pestaña nueva. Filtros: `@/lib/pxListasPreciosFiltros` (SI/NO **Actualizar** = `preciosListaEdicion` `some`/`none` en Prisma; no post-proceso en memoria). Listado GET (`getPxListasPreciosPageDataFromDb`): **no consulta productos** hasta `hayFiltroActivoPxListas` (desplegable o `q` ≥ 3); con filtro, una pasada en paralelo (catálogo, página y count). **No** reescribe staging. `sincronizarPxGeneralDesdeCompetenciaRef` solo en Act. Px (`listarExportPxListasMargenPorLista`). Índices `prod_tienda`: `descripcion_tienda`, `marca`, `rubro`, `sub_rubro`. Catálogo de filtros sin `q` se cachea ~60 s en el proceso.

**Px Competencia** (vs competidores): `getPxCompetenciaPageData` (`unknown` + `getPxCompetenciaPageParamsSchema`) → `pxCompetenciaPage.service.ts` / `pxCompetenciaRows.service.ts`. Precio mostrado: sugerido del proveedor del competidor si existe, si no scraping (`competenciaPxSugerido.service.ts`). Filtros: `@/lib/pxCompetenciaFiltros`.

**Catálogo competidores:** `prod_competencia` + `prod_precios_competencia`. CRUD/relevamiento puntual: `competenciaPrecios.ts` (`competenciaPrecios.acceso` / `editar` + editor). Sync masivo: `POST /api/sync-competencia-precios` (`guardCompetenciaPreciosSyncEsEditor`). `idProveedor` opcional en competidor → puede saltear HTTP.

### 3.6 Comp. Categorías

Jerarquía `CategoriaComparacion` → sub → presentación. Membresía en `prod_comp_item_comparados` (`presentacion_id` + `cod_ext`). **No** hay `prod_precios_provee.id_presentacion`.

- COSTO pantalla: `calcCostoComparacion` suma `dto_extra` al dtoTotal (solo este módulo).
- `dif_px_ref_manual` en la misma fila. Referencias competencia: `prod_comp_present_refs_comp`.
- Mutaciones: `PERMISOS.comparacionCategorias.editar`. Lecturas árbol: RSC → `categoriasComparacion.service.ts`.

### 3.7 Pedidos

Permiso módulo: `PERMISOS.pedidos.acceso` (simple+editor). Ítems vivos: `prod_ped_merc` (`ProdPedMerc2`, UUID).

- Urgente / enviar / tintométrico: `pedidos.ts` + `pedidosEnvio.service.ts`. `comprobarItemsParaGenerarPedidoAction` usa el **servicio** `getItemsTablaEnviarPedido` (no la Action vecina).
- Indicador slidenav: `GET /api/indicador-slidenav` (`obtenerIndicadorSlidenav`; **no** Server Action: Next serializa actions y el armado de Generar Pedido bloqueaba Elegir Usuario ~10 s). `parte=transf` = solo COUNT origen (`hayPendientesTransfDepositosComoOrigen`). `parte=completo` (default) = pedidos (`contarItemsPedidoPorTipoParaSlidenav`, mismos ítems que Generar Pedido, sucursal preferida, `es_fabrica = false`) + transf. El cliente demora el `completo` 2,5 s para no saturar la BD al login. Aviso al login: mismo `parte=transf` + evento de ventana (sobrevive `router.push`). Permiso `pedidos.acceso` / `stock.acceso`; sin permiso el bloque va en 0. `hayPendientesTransfOrigenAction` queda como COUNT de servicio (no lo usa el picker).
- Reposición: `reposicion.ts` (Prisma parcial en Action). `reposicion_forma_pedido`: `UNIDADES_MAX` | `POR_BULTO` | `UNIDADES_FIJAS`. Vendedor (upsert regla): solo `UNIDADES_MAX` + `POR_BULTO`; **BULTO siempre está en el select**. Si `POR_BULTO`, `upsertReglaReposicion` acepta `unidadesPorBulto` (entero ≥ 1) y llama `guardarBultoProdTienda` **antes** de exigir `prod_tienda.bulto` ≥ 1 (el modal envía ese valor para el ítem principal y para cada adicional); `reposicion_cant_conf` = BULTOS REPOSICIÓN (permiso `pedidos.acceso`; no usar `guardarBultoTiendaAction`). Selector de adicionales (`getProductosReposicionSelector`): vínculo habilitado a proveedor no fábrica y `bulto` **null** **o** igual a `bultoReferencia`. Solo se permiten productos con vínculo habilitado a proveedor no fábrica (`global_proveedores.es_fabrica = false`) tanto en grilla de Reposición como en selector de productos adicionales por bulto; `existeListaPrecioParaReposicionCodTienda` debe respetar esa misma condición. Listados de proveedor en Reposición (filtro de página y modal Generar Pedido origen reposición): solo proveedores de mercadería con `global_proveedores.es_fabrica = false`. Pedido A Fáb. (filas `A FÁBRICA`): solo `POR_BULTO` + `UNIDADES_FIJAS`. Cálculo `cantPedirReposicionMerc2` (pedir solo si `stock <= punto`): UNIDADES_MAX → `cantConf - stock` (unidades); UNIDADES_FIJAS → `cantConf` (unidades); POR_BULTO → `cantConf × bulto` (`cantConf` = BULTOS REPOSICIÓN; `bulto` = unidades por bulto de `prod_tienda.bulto`; sin bulto válido → 0). Helper `cantConfReposicionAUnidades`. No reintroducir `CANT_MAX` / `CANT_FIJA_POR_BULTO` como valores persistidos.
- **Historial:** cabecera `prod_ped_historial`; ítems `prod_ped_historial_merc` (writes vía `tx.pedidoHistoriaItem`). Estados `PENDIENTE` | `RECEPCIONADO`. `fecha_recepcion` (`@db.Date`): FECHA FACTURA del modal de recepción; se escribe al marcar RECEPCIONADO y en Guardar Corrección. Distinto de `registrado_at` (instante del POST). Listado NC: `listarPedidosHistoriaRecepcionadosParaNotaCredito`. Asistente NC (`PedidoHistoriaDetalleModal` `variante="nota-credito"`): borrador local; no escribe el pedido origen. **Generar Nota Crédito** abre `DUX_NUEVA_NOTA_CREDITO_DEBITO_COMPRA_URL` en pestaña nombrada `DUX_NOTA_CREDITO_WINDOW_NAME` (`abrirDuxNotaCreditoTab`; no `_blank` / `noopener`) y un checklist UI; no llama `registrarRecepcionCompraDuxAction`. Copiar (cabecera, OK, CANT., Px. Unitario, Nota Generada) enfoca esa pestaña sin recargar (`enfocarDuxNotaCreditoTab`). Correlativo NC: `prod_ped_ult_comp` `id=3` `NOTA_CREDITO` formato `X-00000-########` (`reservarSiguienteNumeroNotaCredito` al **Nota Generada**; preview `obtenerSiguienteNumeroNotaCredito`). Retención: fábrica 60 días / resto 14 (`purgarPedidosHistoriaExpirados` al inicio de cada mutación, no en lecturas). Listado: RSC. Detalle: API. Mutaciones: Actions.
- **Recepción DUX:** `registrarRecepcionCompraDuxAction`. `iva` proveedor → `tipo_comprobante` (`resolverTipoComprobantePorIva` en `exportRecepcionPedidoExcel.service.ts`). `PREGUNTA` sin decisión → `REQUIERE_DECISION_FISCAL`. Nro comprobante: `prod_ped_ult_comp` (`id` 1 Comprobante_Compra, 2 FACTURA, 3 NOTA_CREDITO). Personal: `idPersonal` obligatorio = usuario slidenav (`sessionStorage` / `leerUsuarioSesion`). Precios netos 4 decimales. `cant_recibida` y `prod_ped_historial.total` **admiten negativo** (NC / devolución). Ítems con cantidad 0 no van a DUX; hace falta al menos un ítem ≠ 0 y suma de cantidades ≠ 0. TOTAL PEDIDO distinto de 0 (positivo o negativo). Zod/servicio no usan `.positive()` ni `Math.max(0, …)` sobre esos campos.
- **Pedido A Fáb.:** `pedidoAFabrica.ts` — lectura `estadisticasProductos.acceso` (auth **antes** de Zod); upsert con pedidos **o** estadísticas. Info de STOCK = `prod_tienda_stock.stock_real` por sucursal con `id_deposito` (`DetalleSucursalesPedidoAFabricaModal` variante `stock`; la grilla no tiene columna QUEBR.). Info final = PROM. VTA. de sucursales `genera_est` (1 decimal). Cálculos UI en `@/lib/pedidoAFabricaPromVta` (incluye `sucursalPedidoAFabricaTieneDeposito`; el cliente **no** importa el servicio como valor). PROM. VTA. diario = ventas 2 meses / 48, 1 decimal (`calcularPromVtaDiariaDesdeTotal`). **TIEMPO STOCKEO** = días calendario; en CANT. SUG. se convierte a hábiles (30 → 24) con `diasHabilesVentaDesdeCalendarioPedidoAFabrica`. Fecha Stockeo suma calendario. Vínculo lista↔tienda: `prod_precios_provee.cod_tienda` → `prod_tienda`. Descripción vinculada = `descripcion_tienda`; si no = `descripcion_proveedor`. BULTO solo si hay vínculo (`prod_tienda.bulto`). Filtro **PROD. VINCULADO**: SI/NO en `buildWhereLista` (`prod_tienda` vía `cod_tienda`; paginado en servidor). SI = hay `prod_tienda`; NO = sin vínculo. Filtro **PEDIDO**: SI/NO en `buildWhereLista` (`cod_ext` de filas A FÁBRICA con `urgente_cant_pedir > 0`; paginado en servidor). STOCK QUEBRADO es filtro de UI (solo si SI/NO está elegido): `UN. ACT. ≤ 0` o stock hasta llegada ≤ 0 (`esStockQuebradoPedidoAFabrica`). FORMA PEDIR en `reposicion_forma_pedido` de filas `A FÁBRICA` (no UNIDADES_MAX). UI fábrica: labels **BULTO** / **UNIDAD**. CANT. SUGERIDA: UNIDAD → `Math.ceil`; BULTO → techo al múltiplo del bulto (sin bulto = vacío).

### 3.8 Finanzas

Lectura: `PERMISOS.finanzas.acceso`. Mutaciones de catálogo/tesorería/IVA: + `esEditor()` (`requireEditorFinanzas`).

**Comprobantes DUX** (`fin_compras_comprobante`): sync por Action editor + progreso `GET /api/sync-compras-proveedor-dux/status` (`guardFinanzasLectura`). Unique natural para upsert. Ventana ~150 días AR. `id_proveedor` = `id_proveedor_dux`. **Plan de pago:** `plazo_pago_1_dias`…`plazo_pago_4_dias` (override; null en el 1.º = plan del proveedor). Cuotas iguales = `total / N`; `monto_aplicado` FIFO por cuota. Expansión SQL: `src/lib/comprobanteCuotasPlazoPago.ts` (`SQL_CTE_CUOTAS_MERCADERIA`). Deuda / flujo: `deudaProveedores.service.ts`, `vencimientosPorFecha.service.ts`. UI: `controlComprobantes.ts` + `/finanzas/control-comprobantes`.

**Fact & Cobros** (`fin_fact_cobros_pto_vta_mes`): unique `(pto_vta_id, mes, anio)` FK Restrict a `global_pto_vtas`. No guarda facturas ni ítems. Sync editor: `POST /api/sync-facturas-ventas-dux` (pasos reanudables, 1 página DUX por POST) + `GET …/status`. Guard POST `guardFinanzasEditor`; status `guardFinanzasLectura`. Cliente DUX `duxFacturasApi.ts` (`GET /WSERP/rest/services/facturas`, fechas `yyyy-MM-dd`, `idEmpresa` = `DUX_ID_EMPRESA_COMPRAS`, `idSucursal` = `id_dux` de sucursales asociadas al catálogo, `anuladas=false`, limit 50). Regla: suma `total_factura_asociada` si `letra_comp` A|C; `NOTA_CREDITO*` resta; anuladas se ignoran. Solo `nro_pto_vta` que exista en `global_pto_vtas.pto_venta` y cuya sucursal DUX esté en `suc_asociadas`. Periodo = `fecha_comp` en calendario AR. Listado RSC `listarFinFactCobrosPtoVtaMes` (PTO. VENTA / NOMBRE / TOTAL). UI `/finanzas/fact-cobros`.

**`global_pto_vtas`:** catálogo de puntos de venta (`pto_venta` unique Int; `nombre_pto_venta` mayúsculas `es-AR`). **`suc_asociadas`:** N:M vía `global_pto_vta_sucursales` (`pto_vta_id` Cascade, `sucursal_id` Restrict a `global_sucursales` con `genera_est = true`; mín. 1 sucursal). CRUD editor: `globalPtoVtas.ts` + `globalPtoVtas.service.ts`. Lectura RSC en Fact & Cobros.

**Tesorería:** `CajaTesoreria.tipoCaja` usa enum `TipoCajaTesoreria`. El modelo `FinTesoreriaTipoCaja` existe en schema (seed) pero **la app no lo lee**; no dropear sin decisión explícita. Cheques: `finTesoreriaCheques.ts`.

**Gastos jerárquicos:** tipo → rubro → gasto → gasto final → imputación mensual. Catálogo: `finBalGastosCatalogo.ts`. Imputaciones: `finBalGastoMensualBalance.ts`. `listarImputacionesMensualesBalance({ meses, anio })`: `meses` vacío = todas las imputaciones del `anio` (sin filtro de mes). Gasto eventual vendedor: `requireCargarGastoEventual`.

**Balance mensual** (`/finanzas/balance/mensual`): solo lectura. Resumen `resumenBalanceMensualDesdeFilas` (`src/lib/balanceMensual.ts`) con imputaciones + `fin_bal_vtas`. Ventas se editan en Ventas Mensuales (`guardarFinBalVtasCargaPeriodoAction`, editor). Grilla de Ventas Mensuales: una fila por mes/año desde el mes AR actual hasta la carga más antigua; borrar periodo = `eliminarFinBalVtasPorPeriodo` (todas las sucursales de ese mes/año). Sucursales `genera_balance`; costos de `centro_costo` sin `genera_balance` se reparte. UI de colores/grid: `FRONTEND_GUIDELINES` (Balance mensual).

**IVA:** débito se lee de `fin_bal_iva_deb_import` (sin import TXT/CSV). Saldo manual y comparación pedido. Mutaciones editor (salvo alta de débito por archivo, eliminada). UI: FINANZAS → IMPUESTOS → Posición De IVA (`/finanzas/posicion-iva`).

**Análisis M.C.:** `fin_ana_cos_fina` + fórmulas `fin_ana_mc_formulas` + categorías `fin_ana_mc_cat`. Signo descuento: `1 + %/100` (negativo = descuento). UI categorías: `reemplazarFinAnaMcCategoriasAction` (no CRUD granular).

### 3.9 Estadísticas por producto

Área Administración; URLs `/estadisticas-productos/...`. Permiso `estadisticasProductos.acceso`; mutaciones + editor.

- Hechos `est_por_prod`: unique sucursal+mes+anio+cod_tienda. Sucursales `genera_est`. **Import/verificar/borrar periodo = API** (`guardEstPorProdImportarEsEditor`), no Actions. Grilla desde `EST_POR_PROD_CARGA_DESDE` (Mayo 2026).
- Catálogos (Actions): colores, unidades, presentaciones, terminaciones. Match sobre `descripcion_tienda`.
- Categorización / Estadísticas Vtas: servicios `estCategorizacion` / `estVtas`; agregaciones de gráficos en cliente. Filtros de producto (marca, rubro, sub rubro, color, terminación, presentación) son multi en cliente (`estFiltrosMulti`: OR dentro de la dimensión). Gráfico 1 y Top 10: % participación = Un. ítem / Un. total filtrado (`totalUnidadesGraficoEstVtas` / `agregarTopProductos.totalUnidades`).

### 3.10 Marketing

`PERMISOS.marketing.acceso` (simple+editor lectura). CRUD + export Sheets: `requireEditorMarketing`.

- Publicaciones `mkt_publi` N:M redes; 1:1 opcional con idea (`idea_detalle_id` único). `contenido_creado` derivado de URL. Objetivos `mkt_publi_obj` (un destino).
- Ideas: sección + detalle (`titulo_idea`, `detalle` opcional). `usada` se deriva de la publicación. Tabla puente `MktPublicacionIdeaDetalleRed` se **lee** en include; la UI **no escribe** redes del detalle.
- Base multimedia + tipos + colores marca.
- **Export Sheets:** `exportarMktGoogleSheetsAction` — una corrida, sobrescribe pestañas (Indice, Publicaciones por red, catálogos). Servicio `googleSheetsExportMktSecciones.service.ts`.

### 3.11 Asistente IA

`PERMISOS.asistenteIa.acceso` (simple+editor). CRUD prompts/catálogos: `requireEditorAsistenteIa`. Tablas `prod_ia_diseno_promp`, `prod_ia_diseno_promp_var`, `prod_ia_diseno_catalogo` (kind unificado). Runtime de imagen/cuentagotas es **cliente**; el prompt vive en BD. Detalle de capas/CSV: `docs/AGENTEIA_GUIDELINES.md`.

### 3.12 Sync DUX lista tienda y APIs

Única entrada: `GET`/`POST /api/sync-lista-precios-tienda` + `…/status` + `…/cancel`. Guard `guardTiendaListaPreciosSincronizar`. Pasos reanudables: `syncListaPrecioTiendaRunStep` + estado `sync_dux_status`. Cancelación cooperativa (`running = false`); **no** actualiza `last_completed_at`. Cliente encadena POST con `continuing: true`. Persistencia por chunks; el upsert escribe `last_sync` en alta y en update. Al finalizar (solo si `processed > 0`): borra `prod_tienda` con `last_sync` anterior a `started_at` (ítems que DUX ya no envió). Antes del delete, `est_por_prod` (FK Restrict); hijas Cascade/SetNull. Luego huérfanos: `limpiarHuerfanosProdTienda`. El upsert **no** escribe `prod_tienda.bulto`.

Otras APIs: import lista, parse PDF, sync competencia, import/borrar `est_por_prod`, detalle historial pedidos, PDF comprobante de envíos (`GET /api/envios/[id]/comprobante`), sync facturas ventas (`POST /api/sync-facturas-ventas-dux`). Todas con guard en `apiRouteAuth` (o el mismo criterio).

### 3.13 Tipos de pintura (`prod_rendimientos`)

Tabla en BD **sin modelo Prisma**. CRUD raw SQL en `tiposPinturaRendimientos.ts`. Lectura `tienda.tintoLts`; mutaciones + `esEditor()`. `tipo_pintura` en MAYÚSCULAS. **No** modelar como columna en `prod_tienda`.

### 3.14 Mapa Prisma → SQL (vigente)

Los ~71 modelos de `schema.prisma` están en uso (directo, `tx.` o include). Script: `npm run db:audit-schema`. El script solo cuenta `prisma.<camel>`: `PedidoHistoriaItem`, `ProdPedUltComp`, `MktPublicacionRedLink` se usan vía `tx.` / relaciones.

`prod_rendimientos` no tiene `@@map` en schema (raw SQL, **§3.13**).

### 3.15 Envios (Vendedor)

URL canónica: `/gestion-productos/envios/programados` y `/gestion-productos/envios/conductor` → `src/app/envios/...`. Alias `/envios/crear` redirige a Conductor. Permiso `PERMISOS.envios.acceso` (`requireEnvios`): `simple` y `editor` leen y mutan (excepción **§1.2.3**). Conductor lista `listarEnviosPendientesConductor` (`fecha_envio` ≥ hoy AR y `entregado = false`, orden `fecha_envio` / `hora_desde` / `hora_hasta` asc — más cercanos a ahora primero) y, para el lookup **Direcciones**, reutiliza `listarClientes` + `listarEnviosDirecciones` (solo lectura). La UI de Conductor filtra por sucursal y día (HOY / MAÑANA AR). Estado de entrega: `marcarEnviosFinalEntregadoAction` recibe `{ id, entregado }` para setear `envios_final.entregado` en `true|false` (Programados usa toggle; Conductor confirma `true`). Pantalla sin slidenav: no exige usuario de pestaña. El alta wizard se abre desde Programados. **Gestionar Direcciones** (mismo catálogo `listarClientes` + `listarEnviosDirecciones`) reutiliza `crearClienteAction` / `editarClienteAction` / `eliminarClienteAction` y las actions de `envios_direcciones`.
Al abrir Programados se ejecuta `purgarEnviosFinalAntiguosProgramados()` antes de listar, eliminando envíos con `fecha_envio <= hoyAR-7d` (inclusive), independientemente de `entregado`.

Tablas: `clientes` (catálogo; `nombre_completo` **en mayúsculas** `es-AR` al persistir; **`cel` opcional** (string vacío permitido); `tipo` = `CONSUMIDOR_FINAL` | `PINTOR`; **`pintor_asociado`** FK opcional a otro `clientes`), `envios_direcciones` (**`persona_id`** FK a cliente; en el alta, al `CONSUMIDOR_FINAL`; **`calle_nombre`** (ex `direccion`), **`distrito`**, **`departamento`** opcional = `CIUDAD` | `LAS_HERAS` | `GODOY_CRUZ` | `GUAYMALLEN` | `MAIPU` | `LUJAN`; **`calle_nombre`** y **`distrito`** en **proper case** (primera letra de cada palabra); `numeracion`/`referencia` primera mayúscula de la oración; no aplica a `url_maps`; **al persistir, al menos un dato** CHECK + Zod + servicio), `envios_final` (envío; **`sucursal_id`** FK obligatoria a `global_sucursales`). IDs CUID.

**`clientes.pintor_asociado`:** solo si `tipo = CONSUMIDOR_FINAL`, apunta a un cliente `PINTOR` (no a sí mismo). Si `tipo = PINTOR`, debe ser `NULL` (CHECK SQL + Zod + servicio). Varios `CONSUMIDOR_FINAL` pueden compartir el mismo pintor. No borrar un pintor si está asociado (`Restrict` / `P2003`).

**`envios_final`:** **`sucursal_id`** FK obligatoria a `global_sucursales` (`Restrict`); solo sucursales con **`pedido = true`** (`listarSucursalesParaEnvios` / `validarSucursalParaEnvio` en `enviosFinal.service.ts`). Hasta **dos** clientes, uno por tipo — FKs `cliente_final_id` y `pintor_id` (opcionales, `Restrict`). CHECK SQL + Zod + servicio: al menos uno; el cliente debe ser `CONSUMIDOR_FINAL` y el pintor `PINTOR`. Dirección obligatoria (`direccion_id`) y debe pertenecer al cliente (o al pintor si no hay cliente). **`fecha_envio`** (`@db.Date`, calendario AR): persistir `new Date(\`${iso}T12:00:00.000Z\`)`; leer con `isoYmdFromPrismaDateOnly`. **`hora_desde` / `hora_hasta`** (`VARCHAR(5)`, `HH:MM`): valores 09:00–19:00 en saltos de 30 min; CHECK + Zod: `hora_desde < hora_hasta`. En UI, Select **DESDE** (09:00–18:30) y luego Select **HASTA** (horas posteriores a desde, hasta 19:00). En el alta desde Crear Envío: si el elegido es `CONSUMIDOR_FINAL`, `pintor_id` vacío se completa con `clientes.pintor_asociado`; si el elegido es `PINTOR`, va solo en `pintor_id`. `forma_pagado`: `PAGADO` | `EFECTIVO` | `TRANSFERENCIA` | `POSNET` | `CUENTA_CORRIENTE`. **`PAGADO`** como forma fuerza **`pagado = true`** (`pagadoDesdeFormaPagado` en el servicio). **`observacion_envio`** (`TEXT`, default `""`, Zod máx. 5000): el wizard lo edita en el paso MERCADERÍA. **`entregado`** (`BOOLEAN`, default `false`): el conductor lo marca con confirmación; no se revierte desde Conductor. PDF opcional: `pdf_comprobante` (`BYTEA`, máx. 5 MB, magia `%PDF`) + `pdf_comprobante_nombre`. Listados **no** seleccionan bytes. Orden de listado: `fecha_envio` desc, `hora_desde` asc.

Servicios: `clientes.service.ts`, `enviosDirecciones.service.ts`, `enviosFinal.service.ts`. Actions: `src/actions/envios.ts` (incluye `marcarEnviosFinalEntregadoAction`). Descarga PDF: `GET /api/envios/[id]/comprobante` (`guardEnviosLectura`). No borrar cliente/dirección si hay envío asociado (`P2003`). Alta/edición de dirección también desde el modal de cliente (`CONSUMIDOR_FINAL`): si el cliente no existe aún, se persiste antes de crear la dirección.

---

## 4. Checklist de autocorrección

- [ ] ¿Auth primero + permiso correcto de `PERMISOS`?
- [ ] ¿Mutación crítica con `esEditor()`, o está en **§1.2.3**?
- [ ] ¿Payload `unknown` + `safeParse`? ¿IDs con el schema del modelo?
- [ ] ¿Lógica en `src/services/`? ¿Sin Action→Action?
- [ ] ¿`ActionResult` / shape vacío, sin stack/SQL?
- [ ] ¿Una sola entrada (Action **o** API)?
- [ ] ¿`revalidatePath` de la ruta canónica?
- [ ] ¿Fechas con `@/lib/fechaArgentina`?
- [ ] ¿Este § de dominio actualizado si cambió el contrato?
- [ ] `npx eslint src --max-warnings 0`
- [ ] Si tocaste Actions: `node scripts/audit-actions-usage.mjs`

---

## 5. Anti-patrones — no reintroducir

| Prohibido | Vigente |
|-----------|---------|
| `src/actions/productos.ts`, `editarProducto` / `aplicarCampoMasivo` | `listaPrecios.ts` · `actualizarListaPreciosMasivoAction` |
| `src/lib/validations/productos.ts`, `productoProveedoresPage.ts`, `getProveedoresPageData` | `listaPrecios.service.ts` / `getListaPreciosConOpcionesAction` |
| `src/lib/validations/proveedores.ts`, `pxListas.ts` (legado) | `proveedor.ts`, `pxListasPrecios.ts` |
| `importarListaPreciosProveedor` (Action) | `POST /api/import-lista-precios` |
| Action paralela de sync DUX lista tienda / `syncListaPrecioTiendaFromDux` (wrapper monolítico) | `syncListaPrecioTiendaRunStep` + API |
| `registrarControlTransfDepositosAction` / Excel de transferencia / `prod_stock_transf_dep` | `registrarTransferenciasDepositos` → `stock_trasn_depositos` |
| `volverModoSimple` | Cookie `tienda-app-arranque` + middleware |
| `prod_tienda.cod_ext`, `stockeable` columna, `px_lista_tienda`, `prod_listas_dux`, `prod_tienda_margen_edicion`, `prod_depositos_dux`, `global_sucursales.deposito` (texto) | Vínculo manual, stock por depósito, `prod_tienda_precios` / `_edicion`, catálogo `global_depositos`, FK `id_deposito` |
| Pool `pg` suelto (`src/lib/db.ts`), WhatsApp API | Prisma; sin WhatsApp |
| Helpers `canEdit() => () => Promise<boolean>` | `tienePermisoEditar()` / `actionGates.ts` |
| Re-exportar constantes desde `"use server"` | `src/lib/` / `src/services/` |
| `CANT_MAXIMA` / `CANT_MAX` / `CANT_FIJA` / `CANT_FIJA_POR_BULTO` / `CANT_FIJA_POR_UNIDAD` en `reposicion_forma_pedido` | `UNIDADES_MAX` / `POR_BULTO` / `UNIDADES_FIJAS` |
| `prod_tienda_bultos` / modelo `ProdTiendaBulto` | `prod_tienda.bulto` (`null` = vacío; CHECK `prod_tienda_bulto_positivo`) |
| `ImportarIvaDebitoCsvModal`, `importarFinBalIvaDebCsvAction`, `importarTxtIvaDebitoMes`, `parsearTxtIvaDebitoAfip` | Lectura `listarIvaDebitoFinBalPorAnio` / `listarDetalleIvaDebitoMes` sobre `fin_bal_iva_deb_import` |

**Deuda aceptada (no copiar en código nuevo):** Prisma / SQL inline en `tienda.ts`, `stock.ts`, `reposicion.ts`, `vinculos.ts`, `tiposPinturaRendimientos.ts`. Extraer a servicio si se toca en profundidad. Firmas tipadas (no `unknown`) en varios listados legacy (`comparacionCategorias`, `getPedidoUrgenteData`, etc.): al tocarlas, pasar a `unknown` + Zod.

---

## 6. Herramientas

```bash
node scripts/audit-actions-usage.mjs      # Actions sin call sites
npm run db:audit-schema                   # modelos Prisma vs prisma.*
npm run db:audit-schema-columns           # columnas sin match en src/ (heurística)
npm run db:purge-reposicion-por-bulto     # simulación limpieza REPOSICION+POR_BULTO
npx eslint src --max-warnings 0
```
