-- Identificador de usuario de Meta (BSUID). No es el teléfono ni el phone number ID.

ALTER TABLE "whatsapp_prueba_mensajes" ADD COLUMN "bsuid" VARCHAR(64);

CREATE INDEX "whatsapp_prueba_mensajes_bsuid_idx" ON "whatsapp_prueba_mensajes"("bsuid");
