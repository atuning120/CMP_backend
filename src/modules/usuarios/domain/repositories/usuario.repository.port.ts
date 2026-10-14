export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');

export interface UsuarioRepositoryPort {
  // nombre y email se devuelven para armar el perfil de la sesión móvil
  findByEmail(email: string): Promise<{ idUsuario: number; rol: string; passwordHash: string | null; idOperador: number | null; nombre: string; email: string } | null>;
  findByIdOperador(idOperador: number): Promise<{ idUsuario: number; rol: string; passwordHash: string | null; nombre: string; email: string } | null>;
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

export const GESTION_USUARIOS_REPOSITORY = Symbol('GESTION_USUARIOS_REPOSITORY');

// Usuario tal como lo ve el administrador en el panel web
export interface UsuarioAdministrable {
  idUsuario: number;
  email: string;
  nombre: string;
  rol: string;
  proveedorAuth: string;
  activo: boolean;
  creadoEn: Date;
  esOperador: boolean; // vinculado a una ficha de OPERADOR (usa la app móvil)
}

// Administración de usuarios desde el panel web (solo ADMIN)
export interface GestionUsuariosRepositoryPort {
  listar(): Promise<UsuarioAdministrable[]>;
  findAdministrable(idUsuario: number): Promise<UsuarioAdministrable | null>;
  contarAdminsActivos(): Promise<number>;
  cambiarRol(idUsuario: number, rol: string): Promise<void>;
}
