-- Quitar `disponibilidad` de `fin_tesoreria` (y el enum asociado).

ALTER TABLE "fin_tesoreria" DROP COLUMN IF EXISTS "disponibilidad";

DROP TYPE IF EXISTS "DisponibilidadCajaTesoreria";
