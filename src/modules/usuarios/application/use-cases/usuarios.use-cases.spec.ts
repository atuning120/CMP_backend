import type {
  GestionUsuariosRepositoryPort,
  UsuarioAdministrable,
} from '../../domain/repositories/usuario.repository.port';
import { CambiarEstadoUsuarioUseCase } from './cambiar-estado-usuario.use-case';
import { CambiarRolUsuarioUseCase } from './cambiar-rol-usuario.use-case';
import { CrearUsuarioUseCase } from './crear-usuario.use-case';
import { EditarUsuarioUseCase } from './editar-usuario.use-case';
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
  operador: null,
  esPrincipal: false,
  ...cambios,
});

const crear = (
  encontrado: UsuarioAdministrable | null = usuario(),
  adminsActivos = 2,
  { emailEnUso = false, rutEnUso = false } = {},
) => {
  const repo = {
    listar: jest.fn(async () => [usuario()]),
    findAdministrable: jest.fn(async () => encontrado),
    findAdministrablePorEmail: jest.fn(async () => encontrado),
    passwordHashDe: jest.fn(async (): Promise<string | null> => null),
    contarAdminsActivos: jest.fn(async () => adminsActivos),
    cambiarRol: jest.fn(async () => undefined),
    existeEmail: jest.fn(async () => emailEnUso),
    existeRut: jest.fn(async () => rutEnUso),
    crear: jest.fn(async () => 30),
    cambiarActivo: jest.fn(async () => undefined),
    actualizar: jest.fn(async () => undefined),
  } satisfies GestionUsuariosRepositoryPort;
  return {
    repo,
    listar: new ListarUsuariosUseCase(repo),
    cambiarRol: new CambiarRolUsuarioUseCase(repo),
    crearUsuario: new CrearUsuarioUseCase(repo),
    cambiarEstado: new CambiarEstadoUsuarioUseCase(repo),
    editar: new EditarUsuarioUseCase(repo),
  };
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

describe('CrearUsuarioUseCase', () => {
  const VISOR = { nombre: ' Ana ', apellido: 'Rojas', email: ' Ana.Rojas@CMP.cl ', rol: 'VISOR', accesoMicrosoft: true };
  const OPERADOR = { nombre: 'Juan', apellido: 'Pérez', email: 'juan.perez@cmp.cl', rol: 'OPERADOR', rut: '12345678-5', password: 'clave-segura' };

  it('un usuario web con Microsoft queda sin contraseña', async () => {
    const { repo, crearUsuario } = crear();

    await crearUsuario.execute({ datos: VISOR, autor: ADMIN });

    expect(repo.crear).toHaveBeenCalledWith({
      email: 'ana.rojas@cmp.cl',
      nombre: 'Ana Rojas',
      rol: 'VISOR',
      proveedorAuth: 'MICROSOFT',
      passwordHash: null,
      operador: null,
    });
  });

  it('un jefe de turno con contraseña entra con credenciales (la contraseña se guarda hasheada)', async () => {
    const { repo, crearUsuario } = crear();

    await crearUsuario.execute({ datos: { ...VISOR, rol: 'JEFE_TURNO', accesoMicrosoft: false, password: 'clave-segura' }, autor: ADMIN });

    const [datos] = repo.crear.mock.calls[0] as unknown as [{ proveedorAuth: string; passwordHash: string }];
    expect(datos.proveedorAuth).toBe('CREDENCIALES');
    expect(datos.passwordHash).toMatch(/^\$2[aby]\$10\$/);
  });

  it('un operador lleva su ficha con el RUT normalizado', async () => {
    const { repo, crearUsuario } = crear();

    await crearUsuario.execute({ datos: { ...OPERADOR, telefono: ' ' }, autor: ADMIN });

    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        rol: 'OPERADOR',
        proveedorAuth: 'CREDENCIALES',
        operador: { nombre: 'Juan', apellido: 'Pérez', rut: '12.345.678-5', telefono: null },
      }),
    );
  });

  it.each([
    ['sin RUT', { rut: undefined }, 'RUT_INVALIDO'],
    ['con dígito verificador incorrecto', { rut: '12.345.678-9' }, 'RUT_INVALIDO'],
    ['sin contraseña', { password: undefined }, 'PASSWORD_REQUERIDA'],
    ['con Microsoft', { accesoMicrosoft: true }, 'MICROSOFT_SIN_APP'],
    ['con contraseña corta', { password: 'corta' }, 'PASSWORD_DEBIL'],
  ])('rechaza un operador %s', async (_caso, cambios, codigo) => {
    const { repo, crearUsuario } = crear();

    expect(await codigoDe(crearUsuario.execute({ datos: { ...OPERADOR, ...cambios }, autor: ADMIN }))).toBe(codigo);
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it.each([
    ['sin nombre', { nombre: '  ' }, 'DATOS_INCOMPLETOS'],
    ['con correo inválido', { email: 'ana.rojas' }, 'EMAIL_INVALIDO'],
    ['con nombre demasiado largo', { nombre: 'a'.repeat(51) }, 'NOMBRE_DEMASIADO_LARGO'],
    ['con rol inexistente', { rol: 'SUPERADMIN' }, 'ROL_INVALIDO'],
    ['sin Microsoft ni contraseña', { accesoMicrosoft: false }, 'PASSWORD_REQUERIDA'],
  ])('rechaza un usuario %s', async (_caso, cambios, codigo) => {
    const { crearUsuario } = crear();

    expect(await codigoDe(crearUsuario.execute({ datos: { ...VISOR, ...cambios }, autor: ADMIN }))).toBe(codigo);
  });

  it('no repite un correo ni un RUT', async () => {
    expect(await codigoDe(crear(usuario(), 2, { emailEnUso: true }).crearUsuario.execute({ datos: VISOR, autor: ADMIN }))).toBe('EMAIL_EN_USO');
    expect(await codigoDe(crear(usuario(), 2, { rutEnUso: true }).crearUsuario.execute({ datos: OPERADOR, autor: ADMIN }))).toBe('RUT_EN_USO');
  });

  it('solo un administrador crea usuarios', async () => {
    const { repo, crearUsuario } = crear();

    expect(await codigoDe(crearUsuario.execute({ datos: VISOR, autor: { idUsuario: 5, rol: 'JEFE_TURNO' } }))).toBe('SIN_PERMISO');
    expect(repo.crear).not.toHaveBeenCalled();
  });
});

describe('CambiarEstadoUsuarioUseCase', () => {
  it('un administrador desactiva y reactiva a un usuario', async () => {
    const { repo, cambiarEstado } = crear();

    expect((await cambiarEstado.execute({ idUsuario: 30, activo: false, autor: ADMIN })).activo).toBe(false);
    expect(repo.cambiarActivo).toHaveBeenCalledWith(30, false);
  });

  it('no desactiva la propia cuenta', async () => {
    const { repo, cambiarEstado } = crear(usuario({ idUsuario: 1, rol: 'ADMIN' }));

    expect(await codigoDe(cambiarEstado.execute({ idUsuario: 1, activo: false, autor: ADMIN }))).toBe('PROPIO_ESTADO');
    expect(repo.cambiarActivo).not.toHaveBeenCalled();
  });

  it('no deja el sistema sin administradores activos', async () => {
    const { cambiarEstado } = crear(usuario({ rol: 'ADMIN' }), 1);

    expect(await codigoDe(cambiarEstado.execute({ idUsuario: 30, activo: false, autor: ADMIN }))).toBe('ULTIMO_ADMIN');
  });

  it.each(['false', 0, undefined])('rechaza el estado %p', async (activo) => {
    const { cambiarEstado } = crear();

    expect(await codigoDe(cambiarEstado.execute({ idUsuario: 30, activo, autor: ADMIN }))).toBe('ESTADO_INVALIDO');
  });

  it('solo un administrador cambia el estado', async () => {
    const { cambiarEstado } = crear();

    expect(await codigoDe(cambiarEstado.execute({ idUsuario: 30, activo: false, autor: { idUsuario: 5, rol: 'VISOR' } }))).toBe('SIN_PERMISO');
  });
});

describe('EditarUsuarioUseCase', () => {
  const FICHA = { idOperador: 7, nombre: 'Juan', apellido: 'Pérez', rut: '12.345.678-5', telefono: null };
  const operador = () => usuario({ rol: 'OPERADOR', proveedorAuth: 'CREDENCIALES', esOperador: true, operador: FICHA });
  const WEB = { nombre: 'Ana María Rojas', email: 'Ana.Rojas@cmp.cl', accesoMicrosoft: true };

  it('edita nombre y correo de un usuario web sin tocar su acceso', async () => {
    const { repo, editar } = crear();

    await editar.execute({ idUsuario: 30, datos: WEB, autor: ADMIN });

    expect(repo.existeEmail).toHaveBeenCalledWith('ana.rojas@cmp.cl', 30);
    expect(repo.actualizar).toHaveBeenCalledWith(30, { email: 'ana.rojas@cmp.cl', nombre: 'Ana María Rojas', acceso: null, operador: null });
  });

  it('restablece la contraseña de un operador y actualiza su ficha', async () => {
    const { repo, editar } = crear(operador());

    await editar.execute({
      idUsuario: 30,
      datos: { ...FICHA, nombre: 'Juan Pablo', rut: '123456785', email: 'juan@cmp.cl', accesoMicrosoft: false, password: 'nueva-clave' },
      autor: ADMIN,
    });

    expect(repo.existeRut).toHaveBeenCalledWith('12.345.678-5', 7);
    const [, cambios] = repo.actualizar.mock.calls[0] as unknown as [number, { nombre: string; acceso: { proveedorAuth: string; passwordHash: string }; operador: object }];
    expect(cambios.nombre).toBe('Juan Pablo Pérez');
    expect(cambios.acceso.proveedorAuth).toBe('CREDENCIALES');
    expect(cambios.acceso.passwordHash).toMatch(/^\$2[aby]\$10\$/);
    expect(cambios.operador).toEqual({ ...FICHA, nombre: 'Juan Pablo' });
  });

  it('sin contraseña nueva, un usuario con contraseña la mantiene', async () => {
    const { repo, editar } = crear(usuario({ proveedorAuth: 'CREDENCIALES' }));

    await editar.execute({ idUsuario: 30, datos: { ...WEB, accesoMicrosoft: false, password: '' }, autor: ADMIN });

    expect(repo.actualizar).toHaveBeenCalledWith(30, expect.objectContaining({ acceso: null }));
  });

  it('pasar a Microsoft quita la contraseña', async () => {
    const { repo, editar } = crear(usuario({ proveedorAuth: 'CREDENCIALES' }));

    await editar.execute({ idUsuario: 30, datos: WEB, autor: ADMIN });

    expect(repo.actualizar).toHaveBeenCalledWith(30, expect.objectContaining({ acceso: { proveedorAuth: 'MICROSOFT', passwordHash: null } }));
  });

  it('dejar Microsoft exige una contraseña', async () => {
    const { repo, editar } = crear();

    expect(await codigoDe(editar.execute({ idUsuario: 30, datos: { ...WEB, accesoMicrosoft: false }, autor: ADMIN }))).toBe('PASSWORD_REQUERIDA');
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('un operador no puede pasar a Microsoft', async () => {
    const { editar } = crear(operador());

    expect(await codigoDe(editar.execute({ idUsuario: 30, datos: { ...FICHA, email: 'juan@cmp.cl', accesoMicrosoft: true }, autor: ADMIN }))).toBe(
      'MICROSOFT_SIN_APP',
    );
  });

  it('el administrador edita su nombre pero no su propio acceso', async () => {
    const yo = usuario({ idUsuario: 1, rol: 'ADMIN', proveedorAuth: 'CREDENCIALES' });

    await crear(yo).editar.execute({ idUsuario: 1, datos: { ...WEB, accesoMicrosoft: false }, autor: ADMIN });
    expect(await codigoDe(crear(yo).editar.execute({ idUsuario: 1, datos: { ...WEB, accesoMicrosoft: false, password: 'otra-clave' }, autor: ADMIN }))).toBe(
      'PROPIO_ACCESO',
    );
  });

  it('no repite el correo ni el RUT de otro usuario', async () => {
    expect(await codigoDe(crear(usuario(), 2, { emailEnUso: true }).editar.execute({ idUsuario: 30, datos: WEB, autor: ADMIN }))).toBe('EMAIL_EN_USO');
    expect(
      await codigoDe(
        crear(operador(), 2, { rutEnUso: true }).editar.execute({ idUsuario: 30, datos: { ...FICHA, email: 'juan@cmp.cl' }, autor: ADMIN }),
      ),
    ).toBe('RUT_EN_USO');
  });

  it('solo un administrador edita usuarios', async () => {
    const { repo, editar } = crear();

    expect(await codigoDe(editar.execute({ idUsuario: 30, datos: WEB, autor: { idUsuario: 5, rol: 'JEFE_TURNO' } }))).toBe('SIN_PERMISO');
    expect(repo.actualizar).not.toHaveBeenCalled();
  });
});

describe('Administrador principal (.env)', () => {
  const principal = () => usuario({ idUsuario: 2, rol: 'ADMIN', email: 'jefe@cmp.cl', proveedorAuth: 'CREDENCIALES', esPrincipal: true });
  const WEB = { nombre: 'Otro Nombre', email: 'jefe@cmp.cl', accesoMicrosoft: false };

  it('nadie le cambia el rol ni lo desactiva', async () => {
    const { repo, cambiarRol, cambiarEstado } = crear(principal(), 3);

    expect(await codigoDe(cambiarRol.execute({ idUsuario: 2, rol: 'VISOR', autor: ADMIN }))).toBe('ADMIN_PRINCIPAL');
    expect(await codigoDe(cambiarEstado.execute({ idUsuario: 2, activo: false, autor: ADMIN }))).toBe('ADMIN_PRINCIPAL');
    expect(repo.cambiarRol).not.toHaveBeenCalled();
    expect(repo.cambiarActivo).not.toHaveBeenCalled();
  });

  it('otro administrador no edita su cuenta ni le restablece la contraseña', async () => {
    const { repo, editar } = crear(principal());

    expect(await codigoDe(editar.execute({ idUsuario: 2, datos: { ...WEB, password: 'tomada-1234' }, autor: ADMIN }))).toBe(
      'ADMIN_PRINCIPAL_SOLO_PROPIO',
    );
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('él mismo edita su nombre, pero no su correo', async () => {
    const yo = { idUsuario: 2, rol: 'ADMIN' };

    const { repo, editar } = crear(principal());
    await editar.execute({ idUsuario: 2, datos: WEB, autor: yo });
    expect(repo.actualizar).toHaveBeenCalledWith(2, expect.objectContaining({ nombre: 'Otro Nombre', acceso: null }));

    expect(await codigoDe(crear(principal()).editar.execute({ idUsuario: 2, datos: { ...WEB, email: 'otro@cmp.cl' }, autor: yo }))).toBe(
      'EMAIL_PRINCIPAL_FIJO',
    );
  });
});
