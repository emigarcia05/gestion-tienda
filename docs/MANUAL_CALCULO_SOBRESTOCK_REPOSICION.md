# Manual: cálculo de sobrestock (otra sucursal) al generar pedido

Documento orientado a **desarrollo** y revisión funcional. Describe cómo el backend determina si hay “sobrestock” en la **otra sucursal** antes de generar un pedido al proveedor, **sin** columnas dedicadas de excedente: el valor se **calcula** en cada consulta.

---

## 1. Cuándo aplica

- En el flujo **Generar pedido** (cualquier combinación de tipos **URGENTE**, **TINTOMÉTRICO**, **REPOSICIÓN**).
- El pedido se arma para **un proveedor** y **la sucursal que ordena** (`guaymallen` o `maipu`).
- Solo se evalúan líneas con **`cod_tienda`** (resolución del producto vía `prod_lista` por ese código).
- Objetivo: **advertir** si en la **otra** tienda hay stock “de más” respecto al tope de reposición (posible **transferencia interna** vs pedido al proveedor) y **bloquear** hasta confirmación.

---

## 2. Fuentes de datos (lectura)

| Concepto | Origen | Notas |
|----------|--------|--------|
| Stock de la otra sucursal | `prod_lista` (`ListaPrecioTienda`) | `stock_maipu` / `stock_guaymallen` según la sucursal **donde se mide** el excedente (siempre la otra respecto a quien pide). Si `stockeable` es `false`, el flujo de sobrestock **no** incluye esa línea (DUX: `ctd_disponible` nulo en algún depósito en la sync de ítems). |
| Tope / configuración | `prod_ped_merc` (`ProdPedMerc2`) en la **otra** sucursal | Filas `tipo_de_pedido` **REPOSICIÓN** con `reposicion_cod_tienda` igual al `cod_tienda` de la línea; resolución de proveedor vía `prod_lista` + LP habilitada (ver `getSobreStockOtraSucursalParaPedidoEnviar`). |
| Cantidad a pedir | Línea del pedido que genera | `cant_pedir` de la sucursal que ordena. |
| `cod_ext` del producto | `prod_lista` | Se obtiene desde `cod_tienda` de la línea. |

**Importante:** no hay columna `tiene_sobrestock` en base; el modal muestra valores **derivados**.

---

## 3. Qué filas entran al cálculo

Función: **`getSobreStockOtraSucursalParaPedidoEnviar`** (`sobreStock.service.ts`).

Entrada: las mismas **`rows`** que devuelve **`getItemsYProveedorParaEnviar`** para el PDF (proveedor + sucursal + tipos), con `cant_pedir > 0` ya filtrado por ese servicio.

Sobre esas filas:

1. Solo se consideran las que tienen **`cod_tienda`** no vacío.
2. Debe existir fila en **`prod_lista`** para ese `cod_tienda` (si no, la línea se omite).
3. Se resuelve **`cod_ext`** desde esa fila de tienda para buscar configuración REPOSICIÓN en la otra sucursal.

Si no queda ninguna fila elegible, `tieneSobreStock: false` e `items: []`.

---

## 4. Reglas de sobrestock (solo otra sucursal)

Para cada línea elegible:

1. **Stock medido:** el de la **otra** sucursal en `prod_lista` (mismo registro que aportó `cod_ext`).
2. **Tope en la otra sucursal:** filas REPOSICIÓN en la otra tienda con el mismo **`cod_tienda`** (clave `reposicion_cod_tienda` en `prod_ped_merc`); prioridad: mismo `id_proveedor` que el pedido → fila con `reposicion_cant_conf > 0` → primera fila. Si no hay ninguna en la otra pero la **línea del pedido** es REPOSICIÓN con `reposicion_cant_conf > 0`, se usa ese tope como referencia contra el stock de la otra tienda.
3. **¿Evaluar?** Solo si hay “ancla”: alguna fila REPOSICIÓN en la otra con contexto útil **o** `reposicion_cant_conf > 0` en la línea del pedido (cuando es REPOSICIÓN).
4. **Reglas A y B** (`evaluarSobrestockEnValores`):
   - **A:** si tope &gt; 0, hay sobrestock si `stock > tope`; exceso = `stock - tope`.
   - **B:** si no hay tope &gt; 0, hay sobrestock si `stock > 0`; exceso = stock; `topeReposicion` en respuesta = `null`.

Cada ítem devuelto lleva `origenDeteccion: "OTRA_SUCURSAL"` y `sucursalCodigoSobrestock` = la otra tienda.

---

## 5. Forma de la respuesta hacia el cliente

La action `getSobreStockReposicionParaModalAction` devuelve:

```ts
{
  ok: true,
  data: {
    tieneSobreStock: boolean;
    items: Array<{
      idItemPedidoEnvio: string; // id de fila en `prod_ped_merc` (nombre histórico en API)
      codExt: string;
      codTienda: string | null;
      descripcionProveedor: string;
      descripcionTienda: string | null;
      stockSucursal: number;       // stock en la otra sucursal
      topeReposicion: number | null;
      sobreStock: number;
      cantPedir: number;           // sucursal que genera el pedido
      sucursalCodigoSobrestock: "guaymallen" | "maipu";
      origenDeteccion: "OTRA_SUCURSAL";
    }>;
  };
}
```

**UI:** si `topeReposicion === null`, celda **TOPE REPOSICIÓN** vacía (sin guiones).

---

## 6. Cómo encaja con “Generar pedido”

1. El usuario confirma **Generar Pedido**.
2. `generarPdfEnviarPedidoAction` **sin** `confirmarSobreStock`.
3. Si hay al menos un ítem con sobrestock en la otra sucursal → **`SOBRESTOCK_REQUIERE_CONFIRMACION:{n}`** **antes** del snapshot.
4. El cliente llama `getSobreStockReposicionParaModalAction` y abre el modal.
5. **Pedir al proveedor igual** reintenta con **`confirmarSobreStock: true`**.

---

## 7. Referencias en código

| Pieza | Ubicación |
|-------|-----------|
| Lógica | `src/services/sobreStock.service.ts` → `getSobreStockOtraSucursalParaPedidoEnviar` |
| Actions | `src/actions/pedidos.ts` → `getSobreStockReposicionParaModalAction`, `generarPdfEnviarPedidoAction` |
| Modal | `src/components/shared/SobreStockReposicionAdvertenciaModal.tsx` |
| Botón | `src/components/pedidos/GenerarPedidoToolbarButton.tsx` |

---

## 8. Resumen

**Sobrestock (este flujo)** = para cada línea del pedido con **`cod_tienda`**, se compara el **stock de la otra sucursal** con el **tope de reposición** resuelto allí (más la excepción de tope en la línea REPOSICIÓN del pedido); si aplica, se bloquea la generación hasta confirmación explícita.
