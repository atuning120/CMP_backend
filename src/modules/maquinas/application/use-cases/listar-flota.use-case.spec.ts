import type { MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';
import { ListarFlotaUseCase } from './listar-flota.use-case';

const crear = () => {
  const maquinaRepo = {
    findById: jest.fn(),
    findActivas: jest.fn(),
    findFlota: jest.fn(async () => []),
    findFlotaById: jest.fn(async () => null),
    tieneTurnoEnCurso: jest.fn(async () => false),
    actualizar: jest.fn(async () => undefined),
    existeNombre: jest.fn(async () => false),
    existePatente: jest.fn(async () => false),
    create: jest.fn(),
    findTipos: jest.fn(async () => []),
    findOperadoresAsignables: jest.fn(async () => []),
    findOperadorAsignable: jest.fn(async () => null),
    reemplazar: jest.fn(async () => 0),
    findMarcas: jest.fn(async () => []),
  } satisfies MaquinaRepositoryPort;
  return { maquinaRepo, listar: new ListarFlotaUseCase(maquinaRepo) };
};

describe('ListarFlotaUseCase', () => {
  it('sin búsqueda o con solo espacios lista toda la flota', async () => {
    const { maquinaRepo, listar } = crear();
    await listar.execute();
    await listar.execute('   ');
    expect(maquinaRepo.findFlota).toHaveBeenNthCalledWith(1, null);
    expect(maquinaRepo.findFlota).toHaveBeenNthCalledWith(2, null);
  });

  it('recorta espacios y limita el largo del texto buscado', async () => {
    const { maquinaRepo, listar } = crear();
    await listar.execute('  cf-01 ');
    await listar.execute('x'.repeat(300));
    expect(maquinaRepo.findFlota).toHaveBeenNthCalledWith(1, 'cf-01');
    expect(maquinaRepo.findFlota).toHaveBeenNthCalledWith(2, 'x'.repeat(100));
  });
});
