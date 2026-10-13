-- Renombre: envios_final -> envios (sin FKs entrantes, triggers ni funciones que la nombren).

ALTER TABLE "envios_final" RENAME TO "envios";

ALTER TABLE "envios" RENAME CONSTRAINT "envios_final_pkey" TO "envios_pkey";
ALTER TABLE "envios" RENAME CONSTRAINT "envios_final_al_menos_una_persona_chk" TO "envios_al_menos_una_persona_chk";
ALTER TABLE "envios" RENAME CONSTRAINT "envios_final_hora_desde_chk" TO "envios_hora_desde_chk";
ALTER TABLE "envios" RENAME CONSTRAINT "envios_final_hora_hasta_chk" TO "envios_hora_hasta_chk";
ALTER TABLE "envios" RENAME CONSTRAINT "envios_final_horario_orden_chk" TO "envios_horario_orden_chk";
ALTER TABLE "envios" RENAME CONSTRAINT "envios_final_cliente_final_id_fkey" TO "envios_cliente_final_id_fkey";
ALTER TABLE "envios" RENAME CONSTRAINT "envios_final_direccion_id_fkey" TO "envios_direccion_id_fkey";
ALTER TABLE "envios" RENAME CONSTRAINT "envios_final_pintor_id_fkey" TO "envios_pintor_id_fkey";
ALTER TABLE "envios" RENAME CONSTRAINT "envios_final_sucursal_id_fkey" TO "envios_sucursal_id_fkey";

ALTER INDEX IF EXISTS "envios_final_cliente_final_id_idx" RENAME TO "envios_cliente_final_id_idx";
ALTER INDEX IF EXISTS "envios_final_direccion_id_idx" RENAME TO "envios_direccion_id_idx";
ALTER INDEX IF EXISTS "envios_final_entregado_idx" RENAME TO "envios_entregado_idx";
ALTER INDEX IF EXISTS "envios_final_fecha_envio_idx" RENAME TO "envios_fecha_envio_idx";
ALTER INDEX IF EXISTS "envios_final_pagado_idx" RENAME TO "envios_pagado_idx";
ALTER INDEX IF EXISTS "envios_final_pintor_id_idx" RENAME TO "envios_pintor_id_idx";
ALTER INDEX IF EXISTS "envios_final_sucursal_id_idx" RENAME TO "envios_sucursal_id_idx";
