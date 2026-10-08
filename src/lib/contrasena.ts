import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** Formato persistido en `usuarios.contrasena`: `scrypt$N$r$p$saltB64$hashB64`. */
const PREFIJO = "scrypt";
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

function derivar(
  contrasena: string,
  salt: Buffer,
  params: { n: number; r: number; p: number; keyLen: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      contrasena.normalize("NFKC"),
      salt,
      params.keyLen,
      { N: params.n, r: params.r, p: params.p, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key))
    );
  });
}

export async function hashContrasena(contrasena: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivar(contrasena, salt, { n: N, r: R, p: P, keyLen: KEY_LEN });
  return [PREFIJO, N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verificarContrasena(
  contrasena: string,
  almacenado: string
): Promise<boolean> {
  const partes = almacenado.split("$");
  if (partes.length !== 6 || partes[0] !== PREFIJO) return false;
  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = partes;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (![n, r, p].every((v) => Number.isInteger(v) && v > 0)) return false;
  const esperado = Buffer.from(hashB64!, "base64");
  if (esperado.length === 0) return false;
  const key = await derivar(contrasena, Buffer.from(saltB64!, "base64"), {
    n,
    r,
    p,
    keyLen: esperado.length,
  });
  return key.length === esperado.length && timingSafeEqual(key, esperado);
}
