import type { RecorridosRepositoryPort } from '../../domain/repositories/recorridos.repository.port';
import { MarcarRecorridoVistoUseCase, ObtenerRecorridosUseCase } from './recorridos-guiados.use-case';

const VISOR = { idUsuario: 7, rol: 'VISOR' };

const crear = (vistos: string[] | null = []) => {
  const repo = {
    vistos: jest.fn(async () => vistos),
    marcarVisto: jest.fn(async (_id: number, recorrido: string) => (vistos ? [...new Set([...vistos, recorrido])] : null)),
  } satisfies RecorridosRepositoryPort;
  return { repo, obtener: new ObtenerRecorridosUseCase(repo), marcar: new MarcarRecorridoVistoUseCase(repo) };
};

describe('ObtenerRecorridosUseCase', () => {
  it('devuelve la lista vacía en el primer ingreso', async () => {
    const { obtener, repo } = crear([]);
    await expect(obtener.execute(VISOR)).resolves.toEqual({ vistos: [] });
    expect(repo.vistos).toHaveBeenCalledWith(7);
  });

  it('acepta los tres roles del panel web', async () => {
    const { obtener } = crear(['web.visor.v1']);
    for (const rol of ['ADMIN', 'JEFE_TURNO', 'VISOR']) {
      await expect(obtener.execute({ idUsuario: 1, rol })).resolves.toEqual({ vistos: ['web.visor.v1'] });
    }
  });

  it('rechaza un rol sin panel web o sin sesión', async () => {
    const { obtener } = crear();
    await expect(obtener.execute({ idUsuario: 1, rol: 'OPERADOR' })).rejects.toMatchObject({ response: { code: 'SIN_PERMISO_RECORRIDO' } });
    await expect(obtener.execute(undefined)).rejects.toMatchObject({ response: { code: 'SIN_PERMISO_RECORRIDO' } });
  });

  it('usuario inexistente: 404', async () => {
    const { obtener } = crear(null);
    await expect(obtener.execute(VISOR)).rejects.toMatchObject({ response: { code: 'USUARIO_NO_ENCONTRADO' } });
  });
});

describe('MarcarRecorridoVistoUseCase', () => {
  it('marca el recorrido y devuelve la lista', async () => {
    const { marcar, repo } = crear([]);
    await expect(marcar.execute({ recorrido: 'web.visor.v1', autor: VISOR })).resolves.toEqual({ vistos: ['web.visor.v1'] });
    expect(repo.marcarVisto).toHaveBeenCalledWith(7, 'web.visor.v1');
  });

  it.each(['', 'visor', 'web.visor', 'web.visor.v', 'WEB.VISOR.V1', "web.visor.v1'; --", 'web.visor.v1.extra', 'a'.repeat(30) + '.visor.v1'])(
    'rechaza el identificador %p',
    async (recorrido) => {
      const { marcar, repo } = crear();
      await expect(marcar.execute({ recorrido, autor: VISOR })).rejects.toMatchObject({ response: { code: 'RECORRIDO_INVALIDO' } });
      expect(repo.marcarVisto).not.toHaveBeenCalled();
    },
  );

  it('rechaza un rol sin panel web', async () => {
    const { marcar } = crear();
    await expect(marcar.execute({ recorrido: 'web.visor.v1', autor: { idUsuario: 1, rol: 'OPERADOR' } })).rejects.toMatchObject({
      response: { code: 'SIN_PERMISO_RECORRIDO' },
    });
  });
});
