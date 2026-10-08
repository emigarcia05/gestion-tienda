-- Renombre de tabla: prod_propios -> prod_lista; columna descripcion_tienda -> descripcion.
-- RENAME conserva datos, FKs entrantes (est_por_prod, prod_precios_provee, ...) e índices.

ALTER TABLE "prod_propios" RENAME TO "prod_lista";
ALTER TABLE "prod_lista" RENAME COLUMN "descripcion_tienda" TO "descripcion";

-- PK / CHECK / FKs propias
ALTER TABLE "prod_lista" RENAME CONSTRAINT "prod_propios_pkey" TO "prod_lista_pkey";
ALTER TABLE "prod_lista" RENAME CONSTRAINT "prod_propios_bulto_positivo" TO "prod_lista_bulto_positivo";
ALTER TABLE "prod_lista" RENAME CONSTRAINT "prod_propios_competencia_id_px_lista_general_fkey" TO "prod_lista_competencia_id_px_lista_general_fkey";
ALTER TABLE "prod_lista" RENAME CONSTRAINT "prod_propios_costo_compra_cod_ext_fkey" TO "prod_lista_costo_compra_cod_ext_fkey";
ALTER TABLE "prod_lista" RENAME CONSTRAINT "prod_propios_id_color_fkey" TO "prod_lista_id_color_fkey";
ALTER TABLE "prod_lista" RENAME CONSTRAINT "prod_propios_id_marca_fkey" TO "prod_lista_id_marca_fkey";
ALTER TABLE "prod_lista" RENAME CONSTRAINT "prod_propios_id_presentacion_fkey" TO "prod_lista_id_presentacion_fkey";
ALTER TABLE "prod_lista" RENAME CONSTRAINT "prod_propios_id_rubro_fkey" TO "prod_lista_id_rubro_fkey";
ALTER TABLE "prod_lista" RENAME CONSTRAINT "prod_propios_id_sub_rubro_id_rubro_fkey" TO "prod_lista_id_sub_rubro_id_rubro_fkey";

-- Índices (los que existan; algunos no están declarados en schema.prisma)
ALTER INDEX IF EXISTS "prod_propios_cod_tienda_idx" RENAME TO "prod_lista_cod_tienda_idx";
ALTER INDEX IF EXISTS "prod_propios_cod_tienda_key" RENAME TO "prod_lista_cod_tienda_key";
ALTER INDEX IF EXISTS "prod_propios_comparar_competencia_idx" RENAME TO "prod_lista_comparar_competencia_idx";
ALTER INDEX IF EXISTS "prod_propios_competencia_id_px_lista_general_idx" RENAME TO "prod_lista_competencia_id_px_lista_general_idx";
ALTER INDEX IF EXISTS "prod_propios_costo_compra_cod_ext_idx" RENAME TO "prod_lista_costo_compra_cod_ext_idx";
ALTER INDEX IF EXISTS "prod_propios_descripcion_tienda_idx" RENAME TO "prod_lista_descripcion_idx";
ALTER INDEX IF EXISTS "prod_propios_id_color_idx" RENAME TO "prod_lista_id_color_idx";
ALTER INDEX IF EXISTS "prod_propios_id_marca_idx" RENAME TO "prod_lista_id_marca_idx";
ALTER INDEX IF EXISTS "prod_propios_id_presentacion_idx" RENAME TO "prod_lista_id_presentacion_idx";
ALTER INDEX IF EXISTS "prod_propios_id_rubro_idx" RENAME TO "prod_lista_id_rubro_idx";
ALTER INDEX IF EXISTS "prod_propios_id_sub_rubro_idx" RENAME TO "prod_lista_id_sub_rubro_idx";
ALTER INDEX IF EXISTS "prod_propios_proveedor_idx" RENAME TO "prod_lista_proveedor_idx";
ALTER INDEX IF EXISTS "prod_propios_ultima_exportacion_excel_idx" RENAME TO "prod_lista_ultima_exportacion_excel_idx";
