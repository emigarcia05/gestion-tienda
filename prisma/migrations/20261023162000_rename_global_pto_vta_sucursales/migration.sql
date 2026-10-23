-- Renombra la N:M puntos de venta × sucursales: global_pto_vta_sucursales → pto_vta_sucursales
-- (con PK, FKs e índice, para que coincidan con los nombres que espera Prisma).

DO $$
BEGIN
  IF to_regclass('public.global_pto_vta_sucursales') IS NOT NULL
     AND to_regclass('public.pto_vta_sucursales') IS NULL THEN
    ALTER TABLE "global_pto_vta_sucursales" RENAME TO "pto_vta_sucursales";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_pto_vta_sucursales_pkey') THEN
    ALTER TABLE "pto_vta_sucursales"
      RENAME CONSTRAINT "global_pto_vta_sucursales_pkey" TO "pto_vta_sucursales_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_pto_vta_sucursales_pto_vta_id_fkey') THEN
    ALTER TABLE "pto_vta_sucursales"
      RENAME CONSTRAINT "global_pto_vta_sucursales_pto_vta_id_fkey" TO "pto_vta_sucursales_pto_vta_id_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_pto_vta_sucursales_sucursal_id_fkey') THEN
    ALTER TABLE "pto_vta_sucursales"
      RENAME CONSTRAINT "global_pto_vta_sucursales_sucursal_id_fkey" TO "pto_vta_sucursales_sucursal_id_fkey";
  END IF;
  IF to_regclass('public.global_pto_vta_sucursales_sucursal_idx') IS NOT NULL THEN
    ALTER INDEX "global_pto_vta_sucursales_sucursal_idx" RENAME TO "pto_vta_sucursales_sucursal_idx";
  END IF;
END $$;
