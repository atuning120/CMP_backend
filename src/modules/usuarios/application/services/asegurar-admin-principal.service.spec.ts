import * as bcrypt from 'bcryptjs';
import type { GestionUsuariosRepositoryPort, UsuarioAdministrable } from '../../domain/repositories/usuario.repository.port';
import type { AdminPrincipalConfig } from '../admin-principal';
import { AsegurarAdminPrincipalService } from './asegurar-admin-principal.service';

const existente = (cambios: Partial<UsuarioAdministrable> = {}): UsuarioAdministrable => ({
  idUsuario: 2,
  email: 'jefe@cmp.cl',
  nombre: 'Jefe Planta',
  rol: 'ADMIN',
  proveedorAuth: 'CREDENCIALES',
  activo: true,
  creadoEn: new Date('2026-01-01T00:00:00Z'),
  esOperador: false,
  operador: null,
  esPrincipal: true,
  ...cambios,
});

const crear = (encontrado: UsuarioAdministrable | null, { password = null as string | null, hashActual = null as string | null } = {}) => {
  const repo = {
    listar: jest.fn(),
    findAdministrable: jest.fn(),
    findAdministrablePorEmail: jest.fn(async () => encontrado),
    passwordHashDe: jest.fn(async () => hashActual),
    contarAdminsActivos: jest.fn(),
    cambiarRol: jest.fn(async () => undefined),
    existeEmail: jest.fn(),
    existeRut: jest.fn(),
    crear: jest.fn(async () => 2),
    cambiarActivo: jest.fn(async () => undefined),
    actualizar: jest.fn(async () => undefined),
  } satisfies GestionUsuariosRepositoryPort;
  const config = { email: 'jefe@cmp.cl', nombre: 'Administrador principal', password } as AdminPrincipalConfig;
  return { repo, servicio: new AsegurarAdminPrincipalService(repo, config) };
};

describe('AsegurarAdminPrincipalService', () => {
  it('lo crea como ADMIN si no existe (con Microsoft si no hay contraseña)', async () => {
    const { repo, servicio } = crear(null);

    await servicio.onApplicationBootstrap();

    expect(repo.crear).toHaveBeenCalledWith({
      email: 'jefe@cmp.cl',
      nombre: 'Administrador principal',
      rol: 'ADMIN',
      proveedorAuth: 'MICROSOFT',
      passwordHash: null,
      operador: null,
    });
  });

  it('lo devuelve a ADMIN y lo reactiva si alguien lo cambió en la base de datos', async () => {
    const { repo, servicio } = crear(existente({ rol: 'VISOR', activo: false }));

    await servicio.onApplicationBootstrap();

    expect(repo.cambiarRol).toHaveBeenCalledWith(2, 'ADMIN');
    expect(repo.cambiarActivo).toHaveBeenCalledWith(2, true);
  });

  it('actualiza la contraseña solo si cambió en el .env', async () => {
    const hashActual = await bcrypt.hash('clave-actual', 4);

    const sinCambio = crear(existente(), { password: 'clave-actual', hashActual });
    await sinCambio.servicio.onApplicationBootstrap();
    expect(sinCambio.repo.actualizar).not.toHaveBeenCalled();

    const cambiada = crear(existente(), { password: 'clave-nueva', hashActual });
    await cambiada.servicio.onApplicationBootstrap();
    expect(cambiada.repo.actualizar).toHaveBeenCalledWith(2, expect.objectContaining({ acceso: expect.objectContaining({ proveedorAuth: 'CREDENCIALES' }) }));
  });

  it('un error no impide que el Backend arranque', async () => {
    const { repo, servicio } = crear(null);
    repo.crear.mockRejectedValueOnce(new Error('sin conexión'));

    await expect(servicio.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
