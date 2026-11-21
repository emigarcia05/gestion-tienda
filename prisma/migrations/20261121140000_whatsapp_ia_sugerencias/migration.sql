-- Borradores de la sugerencia de WhatsApp y notas que la IA debe tener en cuenta.
-- NEGOCIO no lleva teléfono. CHAT sí. No se envía el mensaje solo.

CREATE TYPE "whatsapp_ia_contexto_alcance" AS ENUM ('CHAT', 'NEGOCIO');

CREATE TABLE "whatsapp_ia_sugerencias" (
    "id" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "mensaje_ancla_id" TEXT,
    "cuerpo" TEXT NOT NULL,
    "modelo" VARCHAR(64) NOT NULL,
    "tokens_entrada" INTEGER NOT NULL,
    "tokens_salida" INTEGER NOT NULL,
    "tokens_total" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_ia_sugerencias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_ia_sugerencias_telefono_created_idx" ON "whatsapp_ia_sugerencias"("telefono", "created_at");

CREATE TABLE "whatsapp_ia_contexto" (
    "id" TEXT NOT NULL,
    "alcance" "whatsapp_ia_contexto_alcance" NOT NULL,
    "telefono" TEXT,
    "titulo" VARCHAR(80) NOT NULL,
    "texto" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_ia_contexto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "whatsapp_ia_contexto_alcance_chk" CHECK (
        ("alcance" = 'NEGOCIO' AND "telefono" IS NULL)
        OR ("alcance" = 'CHAT' AND "telefono" IS NOT NULL)
    )
);

CREATE INDEX "whatsapp_ia_contexto_activo_alcance_idx" ON "whatsapp_ia_contexto"("activo", "alcance");

CREATE INDEX "whatsapp_ia_contexto_telefono_idx" ON "whatsapp_ia_contexto"("telefono");
