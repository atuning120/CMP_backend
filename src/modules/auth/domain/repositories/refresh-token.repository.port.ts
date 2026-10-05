export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRegistro {
  idRefreshToken: number;
  idUsuario: number;
  expiraEn: Date;
  revocadoEn: Date | null;
}

// Solo se persiste el hash SHA-256 del refresh token; el token en claro lo conoce únicamente el dispositivo.
export interface RefreshTokenRepositoryPort {
  create(data: { idUsuario: number; tokenHash: string; expiraEn: Date }): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenRegistro | null>;
  revocar(idRefreshToken: number, fecha: Date): Promise<void>;
  revocarTodosDelUsuario(idUsuario: number, fecha: Date): Promise<void>;
}
