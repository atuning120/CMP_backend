import { ImeiDuplicadoError } from '../../domain/repositories/gps.repository.port';
import type { DispositivoGps, GpsRepositoryPort } from '../../domain/repositories/gps.repository.port';
import { EditarGpsUseCase } from './editar-gps.use-case';
import { ListarGpsUseCase } from './listar-gps.use-case';
import { RegistrarGpsUseCase } from './registrar-gps.use-case';

const ADMIN = { rol: 'ADMIN', idUsuario: 1 };
const GPS: DispositivoGps = {
  idGps: 1,
  imei: '864032050668829',
  modelo: 'Jimi LL301',
  numeroSim: null,
  activo: true,
  maquina: null,
  asignadoDesde: null,
  ultimaPosicion: null,
};

const crear = (extra: Partial<DispositivoGps> = {}) => {
  const repo = {
    listar: jest.fn(async () => [GPS]),
    buscar: jest.fn(async (id: number): Promise<DispositivoGps | null> => (id === 1 ? { ...GPS, ...extra } : null)),
    crear: jest.fn(async (): Promise<number> => 1),
    editar: jest.fn(async () => {}),
  };
  return { repo, puerto: repo as unknown as GpsRepositoryPort };
};

const codigo = async (promesa: Promise<unknown>) => {
  try {
    await promesa;
  } catch (error) {
    return ((error as { getResponse(): unknown }).getResponse() as { code: string }).code;
  }
  return null;
};

describe('RegistrarGpsUseCase', () => {
  it('registra el IMEI limpio', async () => {
    const { repo, puerto } = crear();
    await new RegistrarGpsUseCase(puerto).execute(ADMIN, { imei: ' 864032-050668829 ', modelo: ' Jimi LL301 ', numeroSim: '' });
    expect(repo.crear).toHaveBeenCalledWith({ imei: '864032050668829', modelo: 'Jimi LL301', numeroSim: null });
  });

  it.each([
    ['dígito mal copiado', '864032050668828'],
    ['corto', '86403205066882'],
    ['virtual de la app', '900000000000009'],
    ['vacío', undefined],
    ['no es texto', 864032050668829],
  ])('rechaza un IMEI inválido: %s', async (_caso, imei) => {
    expect(await codigo(new RegistrarGpsUseCase(crear().puerto).execute(ADMIN, { imei }))).toBe('IMEI_INVALIDO');
  });

  it('rechaza el modelo reservado de la app y un IMEI ya registrado', async () => {
    const { repo, puerto } = crear();
    const useCase = new RegistrarGpsUseCase(puerto);
    expect(await codigo(useCase.execute(ADMIN, { imei: GPS.imei, modelo: 'app_movil' }))).toBe('DATOS_INVALIDOS');
    repo.crear.mockRejectedValueOnce(new ImeiDuplicadoError());
    expect(await codigo(useCase.execute(ADMIN, { imei: GPS.imei }))).toBe('IMEI_DUPLICADO');
  });
});

describe('EditarGpsUseCase', () => {
  it('cambia solo lo que viene', async () => {
    const { repo, puerto } = crear();
    await new EditarGpsUseCase(puerto).execute(ADMIN, 1, { numeroSim: '+56 9 0000 0000' });
    expect(repo.editar).toHaveBeenCalledWith(1, { numeroSim: '+56 9 0000 0000' });
  });

  it('no da de baja un GPS que está en una máquina', async () => {
    const { repo, puerto } = crear({ maquina: { idMaquina: 33, nombre: 'CF-33' } });
    expect(await codigo(new EditarGpsUseCase(puerto).execute(ADMIN, 1, { activo: false }))).toBe('GPS_ASIGNADO');
    expect(repo.editar).not.toHaveBeenCalled();
  });

  it('rechaza un GPS inexistente y una edición vacía', async () => {
    const useCase = new EditarGpsUseCase(crear().puerto);
    expect(await codigo(useCase.execute(ADMIN, 9, { activo: true }))).toBe('GPS_NO_ENCONTRADO');
    expect(await codigo(useCase.execute(ADMIN, 1, {}))).toBe('SIN_CAMBIOS');
  });
});

describe('permisos', () => {
  it.each(['VISOR', 'OPERADOR'])('%s no gestiona GPS', async (rol) => {
    const { puerto } = crear();
    const autor = { rol, idUsuario: 1 };
    expect(await codigo(new ListarGpsUseCase(puerto).execute(autor))).toBe('SIN_PERMISO');
    expect(await codigo(new RegistrarGpsUseCase(puerto).execute(autor, { imei: GPS.imei }))).toBe('SIN_PERMISO');
    expect(await codigo(new EditarGpsUseCase(puerto).execute(autor, 1, { activo: false }))).toBe('SIN_PERMISO');
  });
});
