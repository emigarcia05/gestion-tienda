-- Rename envios_direcciones → clientes_direcciones (catálogo de direcciones de clientes).

ALTER TABLE "envios_direcciones" RENAME TO "clientes_direcciones";

ALTER TABLE "clientes_direcciones" RENAME CONSTRAINT "envios_direcciones_pkey" TO "clientes_direcciones_pkey";
ALTER TABLE "clientes_direcciones" RENAME CONSTRAINT "envios_direcciones_persona_id_fkey" TO "clientes_direcciones_persona_id_fkey";
ALTER TABLE "clientes_direcciones" RENAME CONSTRAINT "envios_direcciones_al_menos_un_dato_chk" TO "clientes_direcciones_al_menos_un_dato_chk";

ALTER INDEX IF EXISTS "envios_direcciones_persona_id_idx" RENAME TO "clientes_direcciones_persona_id_idx";
ALTER INDEX IF EXISTS "envios_direcciones_calle_nombre_idx" RENAME TO "clientes_direcciones_calle_nombre_idx";
ALTER INDEX IF EXISTS "envios_direcciones_departamento_idx" RENAME TO "clientes_direcciones_departamento_idx";
