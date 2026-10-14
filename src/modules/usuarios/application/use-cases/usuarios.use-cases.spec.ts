import type {
  GestionUsuariosRepositoryPort,
  UsuarioAdministrable,
} from '../../domain/repositories/usuario.repository.port';
import { CambiarRolUsuarioUseCase } from './cambiar-rol-usuario.use-case';
import { ListarUsuariosUseCase } from './listar-usuarios.use-case';

const ADMIN = { idUsuario: 1, rol: 'ADMIN' };
const usuario = (cambios: Partial<UsuarioAdministrable> = {}): UsuarioAdministrable => ({
  idUsuario: 30,
  email: 'nuevo@alumnos.ucn.cl',
  nombre: 'Usuario Nuevo',
  rol: 'VISOR',
  proveedorAuth: 'MICROSOFT',
  activo: true,
  creadoEn: new Date('2026-10-13T12:00:00Z'),
  esOperador: false,
  ...cambios,
});

const crear = (encontrado: UsuarioAdministrable | null = usuario(), adminsActivos = 2) => {
  const repo = {
    listar: jest.fn(async () => [usuario()]),
    findAdministrable: jest.fn(async () => encontrado),
    contarAdminsActivos: jest.fn(async () => adminsActivos),
    cambiarRol: jest.fn(async () => undefined),
  } satisfies GestionUsuariosRepositoryPort;
  return { repo, listar: new ListarUsuariosUseCase(repo), cambiarRol: new CambiarRolUsuarioUseCase(repo) };
};

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('ListarUsuariosUseCase', () => {
  it('un administrador ve la lista de usuarios', async () => {
    const { listar } = crear();

    expect(await listar.execute('ADMIN')).toHaveLength(1);
  });

  it.each(['VISOR', 'JEFE_TURNO', 'OPERADOR'])('un %s no puede ver la lista', async (rol) => {
    const { repo, listar } = crear();

    expect(await codigoDe(listar.execute(rol))).toBe('SIN_PERMISO');
    expect(repo.listar).not.toHaveBeenCalled();
  });
});

describe('CambiarRolUsuarioUseCase', () => {
  it.each(['JEFE_TURNO', 'ADMIN'])('un administrador asciende a un VISOR nuevo a %s', async (rol) => {
    const { repo, cambiarRol } = crear();

    const resultado = await cambiarRol.execute({ idUsuario: 30, rol, autor: ADMIN });

    expect(repo.cambiarRol).toHaveBeenCalledWith(30, rol);
    expect(resultado.rol).toBe(rol);
  });

  it('solo un administrador puede cambiar roles', async () => {
    const { repo, cambiarRol } = crear();

    expect(await codigoDe(cambiarRol.execute({ idUsuario: 30, rol: 'ADMIN', autor: { idUsuario: 5, rol: 'JEFE_TURNO' } }))).toBe('SIN_PERMISO');
    expect(repo.cambiarRol).not.toHaveBeenCalled();
  });

  it.each(['OPERADOR', 'SUPERADMIN', '', 42])('rechaza el rol %p', async (rol) => {
    const { cambiarRol } = crear();

    expect(await codigoDe(cambiarRol.execute({ idUsuario: 30, rol, autor: ADMIN }))).toBe('ROL_INVALIDO');
  });

  it('cambia el rol web de un usuario aunque tenga ficha de operador', async () => {
    const { repo, cambiarRol } = crear(usuario({ rol: 'VISOR', esOperador: true }));

    await cambiarRol.execute({ idUsuario: 30, rol: 'JEFE_TURNO', autor: ADMIN });

    expect(repo.cambiarRol).toHaveBeenCalledWith(30, 'JEFE_TURNO');
  });

  it('no cambia el rol de un operador', async () => {
    const { repo, cambiarRol } = crear(usuario({ rol: 'OPERADOR', esOperador: true }));

    expect(await codigoDe(cambiarRol.execute({ idUsuario: 30, rol: 'VISOR', autor: ADMIN }))).toBe('ROL_NO_EDITABLE');
    expect(repo.cambiarRol).not.toHaveBeenCalled();
  });

  it('un administrador no puede cambiar su propio rol', async () => {
    const { cambiarRol } = crear(usuario({ idUsuario: 1, rol: 'ADMIN' }));

    expect(await codigoDe(cambiarRol.execute({ idUsuario: 1, rol: 'VISOR', autor: ADMIN }))).toBe('PROPIO_ROL');
  });

  it('no deja el sistema sin administradores activos', async () => {
    const { repo, cambiarRol } = crear(usuario({ rol: 'ADMIN' }), 1);

    expect(await codigoDe(cambiarRol.execute({ idUsuario: 30, rol: 'VISOR', autor: ADMIN }))).toBe('ULTIMO_ADMIN');
    expect(repo.cambiarRol).not.toHaveBeenCalled();
  });

  it('quitar el rol a uno de varios administradores sí se permite', async () => {
    const { repo, cambiarRol } = crear(usuario({ rol: 'ADMIN' }), 2);

    await cambiarRol.execute({ idUsuario: 30, rol: 'JEFE_TURNO', autor: ADMIN });

    expect(repo.cambiarRol).toHaveBeenCalledWith(30, 'JEFE_TURNO');
  });

  it('usuario inexistente -> USUARIO_NO_ENCONTRADO', async () => {
    const { cambiarRol } = crear(null);

    expect(await codigoDe(cambiarRol.execute({ idUsuario: 99, rol: 'VISOR', autor: ADMIN }))).toBe('USUARIO_NO_ENCONTRADO');
  });

  it('asignar el mismo rol no escribe nada', async () => {
    const { repo, cambiarRol } = crear();

    await cambiarRol.execute({ idUsuario: 30, rol: 'VISOR', autor: ADMIN });

    expect(repo.cambiarRol).not.toHaveBeenCalled();
  });
});
