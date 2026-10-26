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

// Datos personales de la ficha de operador (la que usa la app móvil)
export interface FichaOperador {
  nombre: string;
  apellido: string;
  rut: string;
  telefono: string | null;
}

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
  operador: (FichaOperador & { idOperador: number }) | null;
  esPrincipal: boolean; // el administrador principal del .env: no se desactiva ni cambia de rol
}

// Alta desde el panel web. Un OPERADOR lleva además su ficha de operador (la que usa la app móvil)
export interface NuevoUsuario {
  email: string;
  nombre: string;
  rol: string;
  proveedorAuth: 'CREDENCIALES' | 'MICROSOFT';
  passwordHash: string | null;
  operador: FichaOperador | null;
}

// Forma de entrar: con contraseña propia o solo con la cuenta Microsoft (sin contraseña)
export interface AccesoUsuario {
  proveedorAuth: 'CREDENCIALES' | 'MICROSOFT';
  passwordHash: string | null;
}

// Edición desde el panel web. acceso null: la forma de entrar y la contraseña no cambian
export interface CambiosUsuario {
  email: string;
  nombre: string;
  acceso: AccesoUsuario | null;
  operador: (FichaOperador & { idOperador: number }) | null;
}

// Administración de usuarios desde el panel web (solo ADMIN)
export interface GestionUsuariosRepositoryPort {
  listar(): Promise<UsuarioAdministrable[]>;
  findAdministrable(idUsuario: number): Promise<UsuarioAdministrable | null>;
  // Sin distinguir mayúsculas ni estado
  findAdministrablePorEmail(email: string): Promise<UsuarioAdministrable | null>;
  passwordHashDe(idUsuario: number): Promise<string | null>;
  contarAdminsActivos(): Promise<number>;
  cambiarRol(idUsuario: number, rol: string): Promise<void>;
  // Sin distinguir mayúsculas ni estado: un usuario desactivado sigue ocupando su correo
  // exceptoIdUsuario: al editar, el correo actual del propio usuario no cuenta como repetido
  existeEmail(email: string, exceptoIdUsuario?: number): Promise<boolean>;
  // Compara el RUT sin puntos ni guion: "12.345.678-5" y "12345678-5" son el mismo operador
  existeRut(rut: string, exceptoIdOperador?: number): Promise<boolean>;
  // Crea el usuario (y su ficha de operador, si la trae) en una sola transacción; devuelve el id del usuario
  crear(datos: NuevoUsuario): Promise<number>;
  cambiarActivo(idUsuario: number, activo: boolean): Promise<void>;
  // Actualiza usuario y ficha en una transacción. Si cambia el acceso, revoca sus refresh tokens:
  // las sesiones abiertas (app y web) ya no se renuevan y deben volver a iniciar sesión
  actualizar(idUsuario: number, cambios: CambiosUsuario): Promise<void>;
}
