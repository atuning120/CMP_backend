import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { TTL_CACHE_SESION_MS, VerificadorSesionService } from './verificador-sesion.service';

type UsuarioActivo = { idUsuario: number; rol: string; idOperador: number | null } | null;

const crear = (usuario: UsuarioActivo) => {
  const findById = jest.fn<Promise<UsuarioActivo>, [number]>().mockResolvedValue(usuario);
  const verificador = new VerificadorSesionService({ findById } as unknown as UsuarioRepositoryPort);
  return { verificador, findById };
};

const AHORA = 1_000_000;

describe('VerificadorSesionService', () => {
  it.each([
    ['operador en la app', { idUsuario: 1, rol: 'OPERADOR', idOperador: 7 }, { sub: 1, rol: 'OPERADOR', idOperador: 7 }],
    ['operador en el panel web (entra como VISOR)', { idUsuario: 1, rol: 'OPERADOR', idOperador: 7 }, { sub: 1, rol: 'VISOR' }],
    ['jefe de turno', { idUsuario: 2, rol: 'JEFE_TURNO', idOperador: null }, { sub: 2, rol: 'JEFE_TURNO' }],
    ['administrador', { idUsuario: 3, rol: 'ADMIN', idOperador: null }, { sub: 3, rol: 'ADMIN' }],
  ])('acepta al %s', async (_caso, usuario, payload) => {
    await expect(crear(usuario).verificador.vigente(payload, AHORA)).resolves.toBe(true);
  });

  it('rechaza a un usuario desactivado (findById solo devuelve activos)', async () => {
    await expect(crear(null).verificador.vigente({ sub: 1, rol: 'ADMIN' }, AHORA)).resolves.toBe(false);
  });

  it.each([
    ['le bajaron el rol', 'VISOR', { sub: 3, rol: 'ADMIN' }],
    ['le subieron el rol (el refresh le dará el token nuevo)', 'ADMIN', { sub: 3, rol: 'VISOR' }],
    ['un VISOR no pasa por OPERADOR en la app', 'VISOR', { sub: 3, rol: 'OPERADOR' }],
  ])('rechaza el token si %s', async (_caso, rolActual, payload) => {
    const { verificador } = crear({ idUsuario: 3, rol: rolActual, idOperador: null });
    await expect(verificador.vigente(payload, AHORA)).resolves.toBe(false);
  });

  it('rechaza el token de operador si la cuenta ya no corresponde a esa ficha', async () => {
    const { verificador } = crear({ idUsuario: 1, rol: 'OPERADOR', idOperador: 8 });
    await expect(verificador.vigente({ sub: 1, rol: 'OPERADOR', idOperador: 7 }, AHORA)).resolves.toBe(false);
  });

  it('rechaza un payload sin usuario o sin rol sin consultar la base', async () => {
    const { verificador, findById } = crear({ idUsuario: 1, rol: 'ADMIN', idOperador: null });
    await expect(verificador.vigente({ sub: undefined as unknown as number, rol: 'ADMIN' }, AHORA)).resolves.toBe(false);
    await expect(verificador.vigente({ sub: 1 }, AHORA)).resolves.toBe(false);
    expect(findById).not.toHaveBeenCalled();
  });

  it('consulta la base una vez por usuario mientras dura la caché, aunque lleguen peticiones juntas', async () => {
    const { verificador, findById } = crear({ idUsuario: 1, rol: 'ADMIN', idOperador: null });
    await Promise.all([1, 2, 3].map(() => verificador.vigente({ sub: 1, rol: 'ADMIN' }, AHORA)));
    await verificador.vigente({ sub: 1, rol: 'ADMIN' }, AHORA + TTL_CACHE_SESION_MS - 1);
    expect(findById).toHaveBeenCalledTimes(1);
  });

  it('nota la desactivación al vencer la caché', async () => {
    const { verificador, findById } = crear({ idUsuario: 1, rol: 'ADMIN', idOperador: null });
    await expect(verificador.vigente({ sub: 1, rol: 'ADMIN' }, AHORA)).resolves.toBe(true);
    findById.mockResolvedValue(null);
    await expect(verificador.vigente({ sub: 1, rol: 'ADMIN' }, AHORA + TTL_CACHE_SESION_MS)).resolves.toBe(false);
  });

  it('no guarda un error de la base: la siguiente petición vuelve a consultar', async () => {
    const { verificador, findById } = crear({ idUsuario: 1, rol: 'ADMIN', idOperador: null });
    findById.mockRejectedValueOnce(new Error('sin conexión'));
    await expect(verificador.vigente({ sub: 1, rol: 'ADMIN' }, AHORA)).rejects.toThrow('sin conexión');
    await expect(verificador.vigente({ sub: 1, rol: 'ADMIN' }, AHORA + 1)).resolves.toBe(true);
    expect(findById).toHaveBeenCalledTimes(2);
  });
});
