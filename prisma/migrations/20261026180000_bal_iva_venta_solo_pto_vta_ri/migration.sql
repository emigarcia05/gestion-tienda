-- Balance IVA: las ventas solo generan IVA débito si el punto de venta es Responsable Inscripto
-- (`ptos_vtas.condicion_iva = 1`). Se borran las filas VENTA ya sincronizadas de otros puntos de venta.
-- Idempotente: una vez borradas, no quedan filas que cumplan la condición.

DELETE FROM "bal_iva" b
USING "vtas_comprobantes" c
JOIN "ptos_vtas" p ON p."id" = c."pto_vta_id"
WHERE b."origen" = 'VENTA'
  AND b."comprobante_vta_id" = c."id"
  AND p."condicion_iva" IS DISTINCT FROM 1;
