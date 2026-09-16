-- Rename pto_ventas_cod_arca → condicion_iva_cod_arca
-- Las FKs desde ptos_vtas / comprobantes_vtas siguen válidas (PostgreSQL actualiza la referencia).

ALTER TABLE "pto_ventas_cod_arca" RENAME TO "condicion_iva_cod_arca";

ALTER TABLE "condicion_iva_cod_arca" RENAME CONSTRAINT "pto_ventas_cod_arca_pkey" TO "condicion_iva_cod_arca_pkey";

ALTER INDEX IF EXISTS "pto_ventas_cod_arca_codigo_key" RENAME TO "condicion_iva_cod_arca_codigo_key";
