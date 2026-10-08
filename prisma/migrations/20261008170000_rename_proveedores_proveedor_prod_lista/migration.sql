-- Renombres: global_proveedores -> proveedores; prod_precios_provee -> proveedor_prod_lista;
-- prod_precios_provee_reglas -> proveedores_precios_reglas.
-- RENAME conserva datos, FKs entrantes, triggers e índices. El cuerpo de las funciones
-- plpgsql NO se actualiza solo: se recrea trg_lista_precios_set_cod_ext.

-- ─── global_proveedores -> proveedores ───────────────────────────────
ALTER TABLE "global_proveedores" RENAME TO "proveedores";

ALTER TABLE "proveedores" RENAME CONSTRAINT "global_proveedores_pkey" TO "proveedores_pkey";
ALTER TABLE "proveedores" RENAME CONSTRAINT "global_proveedores_chk_prefijo_3_letras" TO "proveedores_chk_prefijo_3_letras";

ALTER INDEX IF EXISTS "global_proveedores_codigo_unico_idx" RENAME TO "proveedores_codigo_unico_idx";
ALTER INDEX IF EXISTS "global_proveedores_created_at_idx" RENAME TO "proveedores_created_at_idx";
ALTER INDEX IF EXISTS "global_proveedores_es_fabrica_idx" RENAME TO "proveedores_es_fabrica_idx";
ALTER INDEX IF EXISTS "global_proveedores_id_proveedor_dux_key" RENAME TO "proveedores_id_proveedor_dux_key";
ALTER INDEX IF EXISTS "global_proveedores_nombre_key" RENAME TO "proveedores_nombre_key";
ALTER INDEX IF EXISTS "global_proveedores_nombre_legacy_ux" RENAME TO "proveedores_nombre_legacy_ux";
ALTER INDEX IF EXISTS "global_proveedores_prefijo_ux" RENAME TO "proveedores_prefijo_ux";
ALTER INDEX IF EXISTS "global_proveedores_proveedor_mercaderia_idx" RENAME TO "proveedores_proveedor_mercaderia_idx";

-- ─── prod_precios_provee -> proveedor_prod_lista ─────────────────────
ALTER TABLE "prod_precios_provee" RENAME TO "proveedor_prod_lista";

ALTER TABLE "proveedor_prod_lista" RENAME CONSTRAINT "prod_precios_provee_pkey" TO "proveedor_prod_lista_pkey";
ALTER TABLE "proveedor_prod_lista" RENAME CONSTRAINT "prod_precios_provee_id_proveedor_cod_prod_prov_key" TO "proveedor_prod_lista_id_proveedor_cod_prod_prov_key";
ALTER TABLE "proveedor_prod_lista" RENAME CONSTRAINT "prod_precios_provee_cod_tienda_prod_propios_fkey" TO "proveedor_prod_lista_cod_tienda_fkey";
ALTER TABLE "proveedor_prod_lista" RENAME CONSTRAINT "prod_precios_provee_id_precio_rex_fkey" TO "proveedor_prod_lista_id_precio_rex_fkey";
ALTER TABLE "proveedor_prod_lista" RENAME CONSTRAINT "prod_precios_provee_cx_transporte_check" TO "proveedor_prod_lista_cx_transporte_check";
ALTER TABLE "proveedor_prod_lista" RENAME CONSTRAINT "prod_precios_provee_dto_cantidad_check" TO "proveedor_prod_lista_dto_cantidad_check";
ALTER TABLE "proveedor_prod_lista" RENAME CONSTRAINT "prod_precios_provee_dto_marca_check" TO "proveedor_prod_lista_dto_marca_check";
ALTER TABLE "proveedor_prod_lista" RENAME CONSTRAINT "prod_precios_provee_dto_rubro_check" TO "proveedor_prod_lista_dto_rubro_check";
ALTER TABLE "proveedor_prod_lista" RENAME CONSTRAINT "prod_precios_provee_px_promo_fijo_positivo" TO "proveedor_prod_lista_px_promo_fijo_positivo";

ALTER INDEX IF EXISTS "prod_precios_provee_id_precio_rex_idx" RENAME TO "proveedor_prod_lista_id_precio_rex_idx";

-- ─── prod_precios_provee_reglas -> proveedores_precios_reglas ────────
ALTER TABLE "prod_precios_provee_reglas" RENAME TO "proveedores_precios_reglas";

ALTER TABLE "proveedores_precios_reglas" RENAME CONSTRAINT "prod_precios_provee_reglas_pkey" TO "proveedores_precios_reglas_pkey";
ALTER TABLE "proveedores_precios_reglas" RENAME CONSTRAINT "prod_precios_provee_reglas_al_menos_una_condicion_check" TO "proveedores_precios_reglas_al_menos_una_condicion_check";
ALTER TABLE "proveedores_precios_reglas" RENAME CONSTRAINT "prod_precios_provee_reglas_valor_check" TO "proveedores_precios_reglas_valor_check";
ALTER TABLE "proveedores_precios_reglas" RENAME CONSTRAINT "prod_precios_provee_reglas_id_marca_fkey" TO "proveedores_precios_reglas_id_marca_fkey";
ALTER TABLE "proveedores_precios_reglas" RENAME CONSTRAINT "prod_precios_provee_reglas_id_proveedor_fkey" TO "proveedores_precios_reglas_id_proveedor_fkey";
ALTER TABLE "proveedores_precios_reglas" RENAME CONSTRAINT "prod_precios_provee_reglas_id_rubro_fkey" TO "proveedores_precios_reglas_id_rubro_fkey";

ALTER INDEX IF EXISTS "prod_precios_provee_reglas_campo_dims_ux" RENAME TO "proveedores_precios_reglas_campo_dims_ux";
ALTER INDEX IF EXISTS "prod_precios_provee_reglas_campo_idx" RENAME TO "proveedores_precios_reglas_campo_idx";
ALTER INDEX IF EXISTS "prod_precios_provee_reglas_id_marca_idx" RENAME TO "proveedores_precios_reglas_id_marca_idx";
ALTER INDEX IF EXISTS "prod_precios_provee_reglas_id_proveedor_idx" RENAME TO "proveedores_precios_reglas_id_proveedor_idx";
ALTER INDEX IF EXISTS "prod_precios_provee_reglas_id_rubro_idx" RENAME TO "proveedores_precios_reglas_id_rubro_idx";

-- ─── Trigger cod_ext (BEFORE INSERT/UPDATE en proveedor_prod_lista) ──
CREATE OR REPLACE FUNCTION public.trg_lista_precios_set_cod_ext()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  SELECT COALESCE(NULLIF(trim(p.prefijo), ''), p.codigo_unico) || '-' || NEW.cod_prod_proveedor
  INTO NEW.cod_ext
  FROM proveedores p
  WHERE p.id = NEW.id_proveedor;
  IF NEW.cod_ext IS NULL THEN
    RAISE EXCEPTION 'id_proveedor % no existe en proveedores', NEW.id_proveedor;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;
