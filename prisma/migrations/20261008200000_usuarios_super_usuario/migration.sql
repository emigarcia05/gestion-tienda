-- Modo SUPER: acceso a todos los módulos (actuales y futuros), resuelto en código desde MAIN_APP_AREAS.
ALTER TABLE "usuarios" ADD COLUMN "super_usuario" BOOLEAN NOT NULL DEFAULT false;
