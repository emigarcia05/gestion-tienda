-- Catálogo de sucursales: global_sucursales → sucursales

DO $$
BEGIN
  IF to_regclass('public.sucursales') IS NOT NULL THEN
    NULL;
  ELSIF to_regclass('public.global_sucursales') IS NOT NULL THEN
    ALTER TABLE "global_sucursales" RENAME TO "sucursales";
  ELSE
    RAISE EXCEPTION 'No se encontró global_sucursales para renombrar a sucursales';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_sucursales_pkey') THEN
    ALTER TABLE "sucursales" RENAME CONSTRAINT "global_sucursales_pkey" TO "sucursales_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.global_sucursales_codigo_key') IS NOT NULL THEN
    ALTER INDEX "global_sucursales_codigo_key" RENAME TO "sucursales_codigo_key";
  END IF;
  IF to_regclass('public.global_sucursales_id_deposito_key') IS NOT NULL THEN
    ALTER INDEX "global_sucursales_id_deposito_key" RENAME TO "sucursales_id_deposito_key";
  END IF;
  IF to_regclass('public.global_sucursales_id_dux_key') IS NOT NULL THEN
    ALTER INDEX "global_sucursales_id_dux_key" RENAME TO "sucursales_id_dux_key";
  END IF;
  IF to_regclass('public.global_sucursales_nombre_idx') IS NOT NULL THEN
    ALTER INDEX "global_sucursales_nombre_idx" RENAME TO "sucursales_nombre_idx";
  END IF;
END $$;
