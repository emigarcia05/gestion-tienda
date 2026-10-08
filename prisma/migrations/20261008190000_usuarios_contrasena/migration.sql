-- Hash de contraseña por usuario (bcrypt/argon2; nunca texto plano). Null = sin contraseña.
ALTER TABLE "usuarios" ADD COLUMN "contrasena" TEXT;
