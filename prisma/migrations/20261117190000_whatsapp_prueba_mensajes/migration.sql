-- Conversación de la prueba de Cloud API. No es el teléfono de la sucursal.

CREATE TYPE "whatsapp_prueba_direccion" AS ENUM ('ENTRANTE', 'SALIENTE');

CREATE TYPE "whatsapp_prueba_estado" AS ENUM ('RECIBIDO', 'ACEPTADO', 'ENVIADO', 'ENTREGADO', 'LEIDO', 'FALLIDO');

CREATE TABLE "whatsapp_prueba_mensajes" (
    "id" TEXT NOT NULL,
    "wa_message_id" TEXT NOT NULL,
    "direccion" "whatsapp_prueba_direccion" NOT NULL,
    "telefono" TEXT NOT NULL,
    "nombre" VARCHAR(120),
    "cuerpo" TEXT NOT NULL,
    "tipo" VARCHAR(32) NOT NULL DEFAULT 'text',
    "estado" "whatsapp_prueba_estado" NOT NULL,
    "error_texto" VARCHAR(200),
    "wa_timestamp" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_prueba_mensajes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_prueba_mensajes_wa_message_id_key" ON "whatsapp_prueba_mensajes"("wa_message_id");

CREATE INDEX "whatsapp_prueba_mensajes_telefono_created_idx" ON "whatsapp_prueba_mensajes"("telefono", "created_at");
