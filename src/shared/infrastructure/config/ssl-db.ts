import { readFileSync } from 'node:fs';

/**
 * TLS de la conexión a Postgres. Con DB_SSL=true se verifica el certificado del servidor (que lo firme una CA de
 * confianza y que sea del host de DB_HOST): sin eso, alguien en el camino podría hacerse pasar por la base y leer la
 * contraseña y los datos (man-in-the-middle).
 * - Azure PG: su certificado encadena a DigiCert Global Root G2 / Microsoft RSA Root CA 2017, que ya vienen en Node.js.
 * - Aiven (desarrollo): firma con la CA de su proyecto; se descarga de la consola (ca.pem) y se indica en DB_SSL_CA.
 * DB_SSL_CA acepta la ruta a un archivo PEM o el PEM mismo (por ejemplo como secret del Container App); reemplaza a
 * las CAs de Node.js.
 */
export const leerSslDb = (ssl: string | undefined, ca: string | undefined): { rejectUnauthorized: true; ca?: string } | false => {
  if (ssl !== 'true') return false;
  const valor = ca?.trim();
  if (!valor) return { rejectUnauthorized: true };
  // En una variable de entorno de una sola línea los saltos pueden venir escritos como \n
  const pem = valor.startsWith('-----BEGIN') ? valor.replace(/\\n/g, '\n') : readFileSync(valor, 'utf8');
  return { rejectUnauthorized: true, ca: pem };
};
