-- Vista del tablero de Ventas por usuario. Default gerente: el tablero completo no cambia hasta asignar vendedor.
ALTER TABLE "usuarios" ADD COLUMN "vista_tablero" TEXT NOT NULL DEFAULT 'gerente';

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_vista_tablero_check"
  CHECK ("vista_tablero" IN ('gerente', 'vendedor'));
