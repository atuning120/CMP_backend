import * as bcrypt from 'bcryptjs';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { LoginUseCase } from './login.use-case';
import { EmisorSesionService } from '../services/emisor-sesion.service';
import type { RefreshTokenRepositoryPort } from '../../domain/repositories/refresh-token.repository.port';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import type { OperadorRepositoryPort } from '../../../operadores/domain/repositories/operador.repository.port';

const PASSWORD = 'clave-segura';
// Costo bajo: el test no mide seguridad, solo el flujo
const HASH = bcrypt.hashSync(PASSWORD, 4);

const OPERADOR = { idOperador: 7, estado: 'ACTIVO', nombre: 'Juan', apellido: 'Pérez', rut: '12.345.678-9' };

const crear = (usuario: { rol: string; idOperador: number | null; nombre: string; email: string }) => {
  const usuarioRepo = {
    findByEmail: jest.fn(async () => ({ idUsuario: 3, passwordHash: HASH, ...usuario })),
    findByIdOperador: jest.fn(async () => ({ idUsuario: 3, passwordHash: HASH, rol: usuario.rol, nombre: usuario.nombre, email: usuario.email })),
    findById: jest.fn(),
    create: jest.fn(),
  } satisfies UsuarioRepositoryPort;
  const operadorRepo = {
    findByRut: jest.fn(async () => OPERADOR),
    findPerfil: jest.fn(async () => ({ nombre: OPERADOR.nombre, apellido: OPERADOR.apellido, rut: OPERADOR.rut })),
    create: jest.fn(),
  } satisfies OperadorRepositoryPort;
  const refreshRepo = {
    create: jest.fn(async () => undefined),
    findByHash: jest.fn(),
    revocar: jest.fn(),
    revocarTodosDelUsuario: jest.fn(),
  } as unknown as RefreshTokenRepositoryPort;
  const emisor = new EmisorSesionService(
    { sign: () => 'jwt' } as unknown as JwtService,
    { get: (_k: string, d: string) => d } as unknown as ConfigService,
    refreshRepo,
  );
  return { login: new LoginUseCase(usuarioRepo, operadorRepo, emisor), operadorRepo };
};

describe('LoginUseCase: perfil de la sesión móvil', () => {
  it('operador que ingresa con RUT: devuelve sus datos sin volver a leer el operador', async () => {
    const { login, operadorRepo } = crear({ rol: 'OPERADOR', idOperador: 7, nombre: 'Juan Pérez', email: 'juan@cmp.cl' });

    const sesion = await login.execute({ rut: OPERADOR.rut, password: PASSWORD });

    expect(sesion.perfil).toEqual({ nombre: 'Juan', apellido: 'Pérez', rut: '12.345.678-9', email: 'juan@cmp.cl' });
    expect(operadorRepo.findPerfil).not.toHaveBeenCalled();
  });

  it('operador que ingresa con email: lee el perfil del operador vinculado', async () => {
    const { login, operadorRepo } = crear({ rol: 'OPERADOR', idOperador: 7, nombre: 'Juan Pérez', email: 'juan@cmp.cl' });

    const sesion = await login.execute({ email: 'juan@cmp.cl', password: PASSWORD });

    expect(operadorRepo.findPerfil).toHaveBeenCalledWith(7);
    expect(sesion.perfil).toEqual({ nombre: 'Juan', apellido: 'Pérez', rut: '12.345.678-9', email: 'juan@cmp.cl' });
  });

  it('jefe de turno: usa el nombre completo del usuario, sin RUT', async () => {
    const { login } = crear({ rol: 'JEFE_TURNO', idOperador: null, nombre: 'María González', email: 'maria@cmp.cl' });

    const sesion = await login.execute({ email: 'maria@cmp.cl', password: PASSWORD });

    expect(sesion.rol).toBe('JEFE_TURNO');
    expect(sesion.perfil).toEqual({ nombre: 'María González', apellido: null, rut: null, email: 'maria@cmp.cl' });
  });
});
