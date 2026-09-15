import "server-only";

import forge from "node-forge";
import { esCuitValido } from "@/lib/facturaFiscal";

function assertPrivateKey(
  key: forge.pki.rsa.PrivateKey | null
): asserts key is forge.pki.rsa.PrivateKey {
  if (!key) {
    throw new Error("No se pudo leer la clave privada ARCA.");
  }
}

/**
 * Firma el TRA (PKCS#7 / CMS) para WSAA LoginCms.
 * SHA-1 + atributos autenticados: lo que exige el LoginCms de AFIP/ARCA.
 */
export function firmarTraCms(
  traXml: string,
  certPem: string,
  keyPem: string,
  passphrase: string | null
): string {
  const cert = forge.pki.certificateFromPem(certPem);
  const key = passphrase
    ? forge.pki.decryptRsaPrivateKey(keyPem, passphrase)
    : forge.pki.privateKeyFromPem(keyPem);
  assertPrivateKey(key);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      {
        type: forge.pki.oids.signingTime,
        // @types/node-forge declara `value: string`; en runtime PKCS#7 espera Date → UTCTime.
        value: new Date() as unknown as string,
      },
      { type: forge.pki.oids.messageDigest, value: "" },
    ],
  });
  p7.sign();
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

/** CUIT 11 dígitos del subject del certificado AFIP/ARCA (p. ej. serialNumber=CUIT 20…). */
export function cuitDesdeCertPem(certPem: string): string | null {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    const partes: string[] = [];
    for (const attr of cert.subject.attributes) {
      if (typeof attr.value === "string") partes.push(attr.value);
    }
    const matches = partes.join(" ").match(/\d{11}/g) ?? [];
    for (const d of matches) {
      if (esCuitValido(d)) return d;
    }
    return null;
  } catch {
    return null;
  }
}
