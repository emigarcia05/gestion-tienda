-- Balance IVA: el tipo de movimiento (VENTA, NC COMPRA, GASTO, …) pasa a su propia columna en la UI,
-- calculado desde `origen` y el signo. Se quita el prefijo de tipo de las descripciones ya guardadas.
-- Idempotente: sin prefijo, las expresiones no cambian nada.

UPDATE "bal_iva"
SET "descripcion" = regexp_replace("descripcion", '^(NC VENTA|VENTA|NC COMPRA|COMPRA MERC\.) ', '')
WHERE "origen" IN ('VENTA', 'COMPRA_MERCADERIA')
  AND "descripcion" ~ '^(NC VENTA|VENTA|NC COMPRA|COMPRA MERC\.) ';

UPDATE "bal_iva"
SET "descripcion" = regexp_replace("descripcion", '^(GASTO|CX FIN\. COBRO)( · )?', '')
WHERE "origen" IN ('GASTO', 'CX_FINANCIERO')
  AND "descripcion" ~ '^(GASTO|CX FIN\. COBRO)';
