import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { RegisterAdminUseCase } from './register-admin.use-case';

const CLAVE = 'clave-de-pruebas';
const DTO = { nombre: 'Ana', apellido: 'Pérez', email: 'ana.perez@cmp.cl', password: 'Secreta123' };

const crear = (claveConfigurada: string | null = CLAVE, existente: { idUsuario: number } | null = null) => {
  const usuarioRepo = {
    findByEmail: jest.fn(async () => (existente ? { ...existente, rol: 'JEFE_TURNO', passwordHash: null, idOperador: null, nombre: 'Existente', email: 'existente@cmp.cl' } : null)),
    findByIdOperador: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(async () => 42),
  } satisfies UsuarioRepositoryPort;
  const config = { get: jest.fn(() => claveConfigurada ?? undefined) } as unknown as ConfigService;
  return { usuarioRepo, useCase: new RegisterAdminUseCase(usuarioRepo, config) };
};

describe('RegisterAdminUseCase', () => {
  it('crea un usuario ADMIN con la contraseña hasheada cuando la clave es correcta', async () => {
    const { usuarioRepo, useCase } = crear();

    const resultado = await useCase.execute(DTO, CLAVE);

    expect(resultado).toEqual({ message: 'Administrador registrado exitosamente', idUsuario: 42 });
    const creado = usuarioRepo.create.mock.calls[0][0];
    expect(creado).toMatchObject({ email: DTO.email, nombre: 'Ana Pérez', rol: 'ADMIN', idOperador: null, activo: true });
    expect(await bcrypt.compare(DTO.password, creado.passwordHash)).toBe(true);
  });

  it('queda deshabilitado (404) si ADMIN_SETUP_KEY no está configurada', async () => {
    const { usuarioRepo, useCase } = crear(null);

    await expect(useCase.execute(DTO, CLAVE)).rejects.toBeInstanceOf(NotFoundException);
    expect(usuarioRepo.create).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'otra-clave'])('rechaza con 403 una clave ausente o incorrecta (%p)', async (clave) => {
    const { usuarioRepo, useCase } = crear();

    await expect(useCase.execute(DTO, clave)).rejects.toBeInstanceOf(ForbiddenException);
    expect(usuarioRepo.create).not.toHaveBeenCalled();
  });

  it('rechaza un email ya registrado', async () => {
    const { usuarioRepo, useCase } = crear(CLAVE, { idUsuario: 3 });

    await expect(useCase.execute(DTO, CLAVE)).rejects.toBeInstanceOf(ConflictException);
    expect(usuarioRepo.create).not.toHaveBeenCalled();
  });
});
