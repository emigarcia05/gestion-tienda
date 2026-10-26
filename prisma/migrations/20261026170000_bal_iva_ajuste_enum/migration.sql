-- Balance IVA: origen AJUSTE (ajuste manual de saldo, sin FK de origen).
-- Va solo: el valor nuevo de un enum no se puede usar en la misma transacción en que se agrega.
ALTER TYPE "OrigenBalIva" ADD VALUE IF NOT EXISTS 'AJUSTE';
