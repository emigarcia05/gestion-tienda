-- Catálogo de marcas Cx. Fin. Cobros → cobros_terminales
-- Origen según migraciones previas: cobros_terminal_marca, cobros_cx_fin_marcas o cx_fin_cobro_marcas.

DO $$
BEGIN
  IF to_regclass('public.cobros_terminales') IS NOT NULL THEN
    NULL;
  ELSIF to_regclass('public.cobros_terminal_marca') IS NOT NULL THEN
    ALTER TABLE "cobros_terminal_marca" RENAME TO "cobros_terminales";
  ELSIF to_regclass('public.cobros_cx_fin_marcas') IS NOT NULL THEN
    ALTER TABLE "cobros_cx_fin_marcas" RENAME TO "cobros_terminales";
  ELSIF to_regclass('public.cx_fin_cobro_marcas') IS NOT NULL THEN
    ALTER TABLE "cx_fin_cobro_marcas" RENAME TO "cobros_terminales";
  ELSE
    RAISE EXCEPTION 'No se encontró la tabla de marcas de cobros para renombrar a cobros_terminales';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cobros_terminal_marca_pkey') THEN
    ALTER TABLE "cobros_terminales" RENAME CONSTRAINT "cobros_terminal_marca_pkey" TO "cobros_terminales_pkey";
  ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cobros_cx_fin_marcas_pkey') THEN
    ALTER TABLE "cobros_terminales" RENAME CONSTRAINT "cobros_cx_fin_marcas_pkey" TO "cobros_terminales_pkey";
  ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cx_fin_cobro_marcas_pkey') THEN
    ALTER TABLE "cobros_terminales" RENAME CONSTRAINT "cx_fin_cobro_marcas_pkey" TO "cobros_terminales_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.cobros_terminal_marca_nombre_key') IS NOT NULL THEN
    ALTER INDEX "cobros_terminal_marca_nombre_key" RENAME TO "cobros_terminales_nombre_key";
  ELSIF to_regclass('public.cobros_cx_fin_marcas_nombre_key') IS NOT NULL THEN
    ALTER INDEX "cobros_cx_fin_marcas_nombre_key" RENAME TO "cobros_terminales_nombre_key";
  ELSIF to_regclass('public.cx_fin_cobro_marcas_nombre_key') IS NOT NULL THEN
    ALTER INDEX "cx_fin_cobro_marcas_nombre_key" RENAME TO "cobros_terminales_nombre_key";
  END IF;

  IF to_regclass('public.cobros_terminal_marca_orden_idx') IS NOT NULL THEN
    ALTER INDEX "cobros_terminal_marca_orden_idx" RENAME TO "cobros_terminales_orden_idx";
  ELSIF to_regclass('public.cobros_cx_fin_marcas_orden_idx') IS NOT NULL THEN
    ALTER INDEX "cobros_cx_fin_marcas_orden_idx" RENAME TO "cobros_terminales_orden_idx";
  ELSIF to_regclass('public.cx_fin_cobro_marcas_orden_idx') IS NOT NULL THEN
    ALTER INDEX "cx_fin_cobro_marcas_orden_idx" RENAME TO "cobros_terminales_orden_idx";
  END IF;
END $$;
