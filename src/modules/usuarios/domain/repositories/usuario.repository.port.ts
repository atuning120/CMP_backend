export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');

export interface UsuarioRepositoryPort {
  findByEmail(email: string): Promise<{ idUsuario: number; rol: string; passwordHash: string | null } | null>;
  findByIdOperador(idOperador: number): Promise<{ idUsuario: number; rol: string; passwordHash: string | null } | null>;
  create(data: { email: string; nombre: string; rol: string; proveedorAuth: string; activo: boolean; idOperador: number | null; passwordHash: string | null }): Promise<number>;
}
