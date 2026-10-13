import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type {
  CuentaMicrosoftRepositoryPort,
  UsuarioCuentaMicrosoft,
} from '../../../usuarios/domain/repositories/usuario.repository.port';
import type { IdentidadMicrosoft, VerificadorEntraIdPort } from '../ports/verificador-entra-id.port';
import { LoginWebUseCase } from './login-web.use-case';

const CMP_TENANT = '11111111-1111-1111-1111-111111111111';
const IDENTIDAD: IdentidadMicrosoft = { oid: 'oid-ana', tid: CMP_TENANT, email: 'ana.rojas@cmp.cl', nombre: 'Ana Rojas' };
const USUARIO: UsuarioCuentaMicrosoft = {
  idUsuario: 24,
  email: 'ana.rojas@cmp.cl',
  nombre: 'Ana Rojas',
  rol: 'JEFE_TURNO',
  activo: true,
  entraOid: 'oid-ana',
};

const crear = (opciones: {
  identidad?: IdentidadMicrosoft | null | Error;
  porOid?: UsuarioCuentaMicrosoft | null;
  porEmail?: UsuarioCuentaMicrosoft | null;
  config?: Record<string, string>;
} = {}) => {
  const repo = {
    findByEntraOid: jest.fn(async () => opciones.porOid ?? null),
    findByEmailCualquierEstado: jest.fn(async () => opciones.porEmail ?? null),
    vincularEntraOid: jest.fn(async () => undefined),
    crearDesdeMicrosoft: jest.fn(async (d: { email: string; nombre: string; oid: string }) => ({
      idUsuario: 99,
      email: d.email,
      nombre: d.nombre,
      rol: 'VISOR',
      activo: true,
      entraOid: d.oid,
    })),
  } satisfies CuentaMicrosoftRepositoryPort;
  const verificador: VerificadorEntraIdPort = {
    verificar: jest.fn(async () => {
      if (opciones.identidad instanceof Error) throw opciones.identidad;
      return opciones.identidad === undefined ? IDENTIDAD : opciones.identidad;
    }),
  };
  const jwt = { sign: jest.fn(() => 'jwt-firmado') };
  const config = { get: jest.fn((clave: string, def: string) => opciones.config?.[clave] ?? def) } as unknown as ConfigService;
  return { repo, jwt, useCase: new LoginWebUseCase(repo, verificador, jwt as unknown as JwtService, config) };
};

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('LoginWebUseCase (Microsoft)', () => {
  it('registra como VISOR a un usuario nuevo de CMP', async () => {
    const { repo, jwt, useCase } = crear();

    const sesion = await useCase.execute({ entraIdToken: 'token' });

    expect(repo.crearDesdeMicrosoft).toHaveBeenCalledWith({ email: 'ana.rojas@cmp.cl', nombre: 'Ana Rojas', oid: 'oid-ana' });
    expect(sesion).toEqual({ accessToken: 'jwt-firmado', rol: 'VISOR', email: 'ana.rojas@cmp.cl', nombre: 'Ana Rojas', nuevo: true });
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 99, rol: 'VISOR' });
  });

  it.each(['juan.perez@ucn.cl', 'cristian.nunez@alumnos.ucn.cl'])('acepta cuentas de la UCN (%s)', async (email) => {
    const { repo, useCase } = crear({ identidad: { ...IDENTIDAD, email } });

    expect(await useCase.execute({ entraIdToken: 'token' })).toMatchObject({ rol: 'VISOR', nuevo: true });
    expect(repo.crearDesdeMicrosoft).toHaveBeenCalledWith(expect.objectContaining({ email }));
  });

  it('acepta el dominio de IMOPAC y usa el correo como nombre si Microsoft no envía uno', async () => {
    const { repo, useCase } = crear({ identidad: { ...IDENTIDAD, email: 'juan.perez@imopac.cl', nombre: null } });

    await useCase.execute({ entraIdToken: 'token' });

    expect(repo.crearDesdeMicrosoft).toHaveBeenCalledWith({ email: 'juan.perez@imopac.cl', nombre: 'juan.perez', oid: 'oid-ana' });
  });

  it('un usuario ya vinculado entra con su rol, sin registrarse de nuevo', async () => {
    const { repo, useCase } = crear({ porOid: USUARIO });

    const sesion = await useCase.execute({ entraIdToken: 'token' });

    expect(sesion).toMatchObject({ rol: 'JEFE_TURNO', nuevo: false });
    expect(repo.crearDesdeMicrosoft).not.toHaveBeenCalled();
    expect(repo.vincularEntraOid).not.toHaveBeenCalled();
  });

  it('vincula la cuenta Microsoft a un usuario existente con el mismo correo', async () => {
    const { repo, useCase } = crear({ porEmail: { ...USUARIO, rol: 'ADMIN', entraOid: null } });

    const sesion = await useCase.execute({ entraIdToken: 'token' });

    expect(repo.vincularEntraOid).toHaveBeenCalledWith(24, 'oid-ana');
    expect(sesion).toMatchObject({ rol: 'ADMIN', nuevo: false });
  });

  it.each([
    ['otro dominio', { email: 'alguien@gmail.com' }],
    ['subdominio parecido', { email: 'alguien@cmp.cl.falso.com' }],
    ['otro subdominio de la UCN no autorizado', { email: 'alguien@otro.ucn.cl' }],
    ['cuenta personal de Microsoft', { tid: '9188040d-6c67-4c5b-b112-36a304b66dad' }],
  ])('rechaza %s con DOMINIO_NO_PERMITIDO', async (_caso, cambio) => {
    const { repo, useCase } = crear({ identidad: { ...IDENTIDAD, ...cambio } });

    expect(await codigoDe(useCase.execute({ entraIdToken: 'token' }))).toBe('DOMINIO_NO_PERMITIDO');
    expect(repo.crearDesdeMicrosoft).not.toHaveBeenCalled();
  });

  it('con AZURE_AD_TENANTS_PERMITIDOS solo acepta esos tenants', async () => {
    const { useCase } = crear({ config: { AZURE_AD_TENANTS_PERMITIDOS: '22222222-2222-2222-2222-222222222222' } });

    expect(await codigoDe(useCase.execute({ entraIdToken: 'token' }))).toBe('DOMINIO_NO_PERMITIDO');
  });

  it('un usuario desactivado no entra ni se vuelve a registrar', async () => {
    const { repo, useCase } = crear({ porEmail: { ...USUARIO, activo: false, entraOid: null } });

    expect(await codigoDe(useCase.execute({ entraIdToken: 'token' }))).toBe('USUARIO_INACTIVO');
    expect(repo.vincularEntraOid).not.toHaveBeenCalled();
    expect(repo.crearDesdeMicrosoft).not.toHaveBeenCalled();
  });

  it('un operador (solo app móvil) no entra al panel web', async () => {
    const { useCase } = crear({ porOid: { ...USUARIO, rol: 'OPERADOR' } });

    expect(await codigoDe(useCase.execute({ entraIdToken: 'token' }))).toBe('SIN_ACCESO_WEB');
  });

  it('rechaza un correo ya vinculado a otra cuenta Microsoft', async () => {
    const { useCase } = crear({ porEmail: { ...USUARIO, entraOid: 'otro-oid' } });

    expect(await codigoDe(useCase.execute({ entraIdToken: 'token' }))).toBe('CUENTA_YA_VINCULADA');
  });

  it('token inválido, ausente o sin correo -> TOKEN_INVALIDO', async () => {
    expect(await codigoDe(crear({ identidad: new Error('firma') }).useCase.execute({ entraIdToken: 'token' }))).toBe('TOKEN_INVALIDO');
    expect(await codigoDe(crear().useCase.execute({ entraIdToken: '' }))).toBe('TOKEN_INVALIDO');
    expect(await codigoDe(crear({ identidad: { ...IDENTIDAD, email: null } }).useCase.execute({ entraIdToken: 'token' }))).toBe('TOKEN_INVALIDO');
  });

  it('sin AZURE_AD_CLIENT_ID responde MICROSOFT_NO_CONFIGURADO', async () => {
    const { useCase } = crear({ identidad: null });

    expect(await codigoDe(useCase.execute({ entraIdToken: 'token' }))).toBe('MICROSOFT_NO_CONFIGURADO');
  });
});
