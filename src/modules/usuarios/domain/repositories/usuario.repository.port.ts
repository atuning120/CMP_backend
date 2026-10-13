export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');

export interface UsuarioRepositoryPort {
  findByEmail(email: string): Promise<{ idUsuario: number; rol: string; passwordHash: string | null; idOperador: number | null } | null>;
  findByIdOperador(idOperador: number): Promise<{ idUsuario: number; rol: string; passwordHash: string | null } | null>;
  findById(idUsuario: number): Promise<{ idUsuario: number; rol: string; idOperador: number | null } | null>;
  create(data: { email: string; nombre: string; rol: string; proveedorAuth: string; activo: boolean; idOperador: number | null; passwordHash: string | null }): Promise<number>;
}

export const CUENTA_MICROSOFT_REPOSITORY = Symbol('CUENTA_MICROSOFT_REPOSITORY');

// Usuario (activo o no) tal como lo necesita el login con Microsoft
export interface UsuarioCuentaMicrosoft {
  idUsuario: number;
  email: string;
  nombre: string;
  rol: string;
  activo: boolean;
  entraOid: string | null;
}

// Alta y vinculación de cuentas Microsoft (login web con Entra ID)
export interface CuentaMicrosoftRepositoryPort {
  findByEntraOid(oid: string): Promise<UsuarioCuentaMicrosoft | null>;
  // Sin filtrar por activo: un usuario desactivado no debe poder registrarse de nuevo con el mismo correo
  findByEmailCualquierEstado(email: string): Promise<UsuarioCuentaMicrosoft | null>;
  vincularEntraOid(idUsuario: number, oid: string): Promise<void>;
  // Alta automática como VISOR con proveedor MICROSOFT
  crearDesdeMicrosoft(datos: { email: string; nombre: string; oid: string }): Promise<UsuarioCuentaMicrosoft>;
}
