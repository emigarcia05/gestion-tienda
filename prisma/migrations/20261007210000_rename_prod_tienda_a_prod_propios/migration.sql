-- Renombre de tablas del catálogo propio (ex "tienda"):
--   prod_tienda                 -> prod_propios
--   prod_tienda_listas_precios  -> prod_propios_listas_precios_nombres
--   prod_tienda_precios         -> prod_propios_listas_precios
--   prod_tienda_precios_edicion -> prod_propios_listas_precios_edicion
-- Las funciones de trigger (fn_uppercase_precios_tienda, trg_lista_precios_tienda_last_sync) no
-- referencian nombres de tabla; los triggers siguen a la tabla automáticamente.

-- 1) Tablas
ALTER TABLE "prod_tienda" RENAME TO "prod_propios";
ALTER TABLE "prod_tienda_listas_precios" RENAME TO "prod_propios_listas_precios_nombres";
ALTER TABLE "prod_tienda_precios" RENAME TO "prod_propios_listas_precios";
ALTER TABLE "prod_tienda_precios_edicion" RENAME TO "prod_propios_listas_precios_edicion";

-- 2) Primary keys (renombra también el índice subyacente)
ALTER TABLE "prod_propios" RENAME CONSTRAINT "prod_tienda_pkey" TO "prod_propios_pkey";
ALTER TABLE "prod_propios_listas_precios_nombres" RENAME CONSTRAINT "prod_tienda_listas_precios_pkey" TO "prod_propios_listas_precios_nombres_pkey";
ALTER TABLE "prod_propios_listas_precios" RENAME CONSTRAINT "prod_tienda_precios_pkey" TO "prod_propios_listas_precios_pkey";
ALTER TABLE "prod_propios_listas_precios_edicion" RENAME CONSTRAINT "prod_tienda_precios_edicion_pkey" TO "prod_propios_listas_precios_edicion_pkey";

-- 3) CHECK
ALTER TABLE "prod_propios" RENAME CONSTRAINT "prod_tienda_bulto_positivo" TO "prod_propios_bulto_positivo";

-- 4) Foreign keys salientes
ALTER TABLE "prod_propios" RENAME CONSTRAINT "prod_tienda_competencia_id_px_lista_general_fkey" TO "prod_propios_competencia_id_px_lista_general_fkey";
ALTER TABLE "prod_propios" RENAME CONSTRAINT "prod_tienda_costo_compra_cod_ext_fkey" TO "prod_propios_costo_compra_cod_ext_fkey";
ALTER TABLE "prod_propios" RENAME CONSTRAINT "prod_tienda_id_color_fkey" TO "prod_propios_id_color_fkey";
ALTER TABLE "prod_propios" RENAME CONSTRAINT "prod_tienda_id_marca_fkey" TO "prod_propios_id_marca_fkey";
ALTER TABLE "prod_propios" RENAME CONSTRAINT "prod_tienda_id_presentacion_fkey" TO "prod_propios_id_presentacion_fkey";
ALTER TABLE "prod_propios_listas_precios" RENAME CONSTRAINT "prod_tienda_precios_cod_tienda_fkey" TO "prod_propios_listas_precios_cod_tienda_fkey";
ALTER TABLE "prod_propios_listas_precios" RENAME CONSTRAINT "prod_tienda_precios_id_lista_fkey" TO "prod_propios_listas_precios_id_lista_fkey";
ALTER TABLE "prod_propios_listas_precios_edicion" RENAME CONSTRAINT "prod_tienda_precios_edicion_cod_tienda_fkey" TO "prod_propios_listas_precios_edicion_cod_tienda_fkey";
ALTER TABLE "prod_propios_listas_precios_edicion" RENAME CONSTRAINT "prod_tienda_precios_edicion_id_lista_fkey" TO "prod_propios_listas_precios_edicion_id_lista_fkey";

-- 5) Foreign keys entrantes cuyo nombre menciona la tabla vieja
ALTER TABLE "prod_precios_competencia" RENAME CONSTRAINT "prod_precios_competencia_cod_tienda_prod_tienda_fkey" TO "prod_precios_competencia_cod_tienda_prod_propios_fkey";
ALTER TABLE "prod_precios_provee" RENAME CONSTRAINT "prod_precios_provee_cod_tienda_prod_tienda_fkey" TO "prod_precios_provee_cod_tienda_prod_propios_fkey";

-- 6) Índices (condicionales: algunos existen solo en ciertos entornos)
DO $$
DECLARE
  par text[];
  pares text[][] := ARRAY[
    ARRAY['prod_precios_tienda_cod_tienda_key', 'prod_propios_cod_tienda_key'],
    ARRAY['prod_tienda_cod_tienda_idx', 'prod_propios_cod_tienda_idx'],
    ARRAY['prod_tienda_comparar_competencia_idx', 'prod_propios_comparar_competencia_idx'],
    ARRAY['prod_tienda_competencia_id_px_lista_general_idx', 'prod_propios_competencia_id_px_lista_general_idx'],
    ARRAY['prod_tienda_costo_compra_cod_ext_idx', 'prod_propios_costo_compra_cod_ext_idx'],
    ARRAY['prod_tienda_descripcion_tienda_idx', 'prod_propios_descripcion_tienda_idx'],
    ARRAY['prod_tienda_id_color_idx', 'prod_propios_id_color_idx'],
    ARRAY['prod_tienda_id_presentacion_idx', 'prod_propios_id_presentacion_idx'],
    ARRAY['prod_tienda_marca_idx', 'prod_propios_marca_idx'],
    ARRAY['prod_tienda_proveedor_idx', 'prod_propios_proveedor_idx'],
    ARRAY['prod_tienda_rubro_idx', 'prod_propios_rubro_idx'],
    ARRAY['prod_tienda_sub_rubro_idx', 'prod_propios_sub_rubro_idx'],
    ARRAY['prod_tienda_ultima_exportacion_excel_idx', 'prod_propios_ultima_exportacion_excel_idx'],
    ARRAY['prod_tienda_precios_id_lista_idx', 'prod_propios_listas_precios_id_lista_idx'],
    ARRAY['prod_tienda_precios_edicion_id_lista_idx', 'prod_propios_listas_precios_edicion_id_lista_idx']
  ];
BEGIN
  FOREACH par SLICE 1 IN ARRAY pares LOOP
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = par[1]) THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', par[1], par[2]);
    END IF;
  END LOOP;
END $$;
