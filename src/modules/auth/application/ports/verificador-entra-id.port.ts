export const VERIFICADOR_ENTRA_ID = Symbol('VERIFICADOR_ENTRA_ID');

// Datos de la cuenta Microsoft que trae un ID token ya verificado (firma, audiencia, emisor y vigencia)
export interface IdentidadMicrosoft {
  oid: string; // id inmutable del usuario en su tenant
  tid: string; // tenant (organización) de la cuenta
  email: string | null; // claim email o, si falta, preferred_username (UPN)
  nombre: string | null;
}

export interface VerificadorEntraIdPort {
  // Lanza error si el token no es válido; devuelve null si la integración no está configurada
  verificar(idToken: string): Promise<IdentidadMicrosoft | null>;
  // Tenant que verificó ese dominio en Entra ID (null si ninguno lo tiene). Lanza error si Microsoft no responde
  tenantDelDominio(dominio: string): Promise<string | null>;
}
