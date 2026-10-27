import type { MaquinaFlota, MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';
import { DevolverMaquinaUseCase } from './devolver-maquina.use-case';

const maquina = (id: number, nombre: string, extra: Partial<MaquinaFlota> = {}): MaquinaFlota => ({
  idMaquina: id,
  nombre,
  marca: 'Caterpillar',
  modelo: 'D10T',
  tipoMaquina: 'Bulldozer',
  estado: 'ACTIVA',
  patente: null,
  anio: null,
  numeroChasis: null,
  esContratista: false,
  operadorAsignado: null,
  motivoEstado: null,
  operadorActual: null,
  estadoOperacional: null,
  ubicacionActual: null,
  idAreaActual: null,
  idZonaActual: null,
  horometroActual: 100,
  regresoEstimado: null,
  respaldo: null,
  cubreA: null,
  version: 1,
  actualizadoEn: null,
  actualizadoPor: null,
  ...extra,
});

// BD-01 falló y lo cubre BD-05 (que estaba en reserva) con Ana a cargo
const original = maquina(1, 'BD-01', {
  estado: 'EN_MANTENIMIENTO',
  regresoEstimado: new Date('2030-01-03T08:00:00Z'),
  respaldo: { idMaquina: 5, nombre: 'BD-05', estadoAlDevolver: 'EN_RESERVA' },
});
const respaldo = maquina(5, 'BD-05', { operadorAsignado: { idOperador: 4, nombre: 'Ana Soto' }, cubreA: { idMaquina: 1, nombre: 'BD-01' } });

const crear = (opciones: { enUso?: boolean; original?: MaquinaFlota } = {}) => {
  const flota = new Map([opciones.original ?? original, respaldo].map((m) => [m.idMaquina, m]));
  const maquinaRepo = {
    findById: jest.fn(),
    findActivas: jest.fn(),
    findFlota: jest.fn(),
    findFlotaById: jest.fn(async (id: number) => flota.get(id) ?? null),
    existeNombre: jest.fn(),
    existePatente: jest.fn(),
    tieneTurnoEnCurso: jest.fn(async () => opciones.enUso ?? false),
    create: jest.fn(),
    actualizar: jest.fn(),
    findOperadoresAsignables: jest.fn(),
    findOperadorAsignable: jest.fn(),
    reemplazar: jest.fn(),
    devolver: jest.fn(async () => undefined),
    findTipos: jest.fn(),
    findMarcas: jest.fn(),
  } satisfies MaquinaRepositoryPort;
  return { maquinaRepo, devolver: new DevolverMaquinaUseCase(maquinaRepo) };
};

const base = { rol: 'JEFE_TURNO', idUsuario: 7, idMaquina: '1', motivo: 'Reparación terminada' };
const registro = { idUsuario: 7, motivo: 'Reparación terminada', observacion: null };

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('DevolverMaquinaUseCase', () => {
  it('la original vuelve con el operador del respaldo y el respaldo vuelve a reserva', async () => {
    const { maquinaRepo, devolver } = crear();
    await devolver.execute(base);
    expect(maquinaRepo.devolver).toHaveBeenCalledWith({
      idOriginal: 1,
      idRespaldo: 5,
      estadoRespaldo: 'EN_RESERVA',
      idOperador: 4,
      versiones: [
        { idMaquina: 1, version: 1 },
        { idMaquina: 5, version: 1 },
      ],
      accionesOriginal: [
        {
          ...registro,
          accion: 'DEVOLVER',
          detalle: { respaldo: 'BD-05', operador: 'Ana Soto', antes: { estado: 'EN_MANTENIMIENTO' }, despues: { estado: 'ACTIVA' } },
        },
      ],
      accionesRespaldo: [
        { ...registro, accion: 'CAMBIAR_ESTADO', detalle: { devueltaA: 'BD-01', antes: { estado: 'ACTIVA' }, despues: { estado: 'EN_RESERVA' } } },
        {
          ...registro,
          accion: 'EDITAR',
          observacion: 'Ana Soto volvió a BD-01',
          detalle: { antes: { operador: 'Ana Soto' }, despues: { operador: null } },
        },
      ],
    });
  });

  it('no devuelve si el respaldo tiene un turno en curso (primero se cierra)', async () => {
    const { maquinaRepo, devolver } = crear({ enUso: true });
    expect(await codigoDe(devolver.execute(base))).toBe('MAQUINA_EN_USO');
    expect(maquinaRepo.devolver).not.toHaveBeenCalled();
  });

  it('exige permiso, motivo y que la máquina tenga un respaldo', async () => {
    const { devolver } = crear();
    expect(await codigoDe(devolver.execute({ ...base, rol: 'OPERADOR' }))).toBe('SIN_PERMISO');
    expect(await codigoDe(devolver.execute({ ...base, motivo: ' ' }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(devolver.execute({ ...base, idMaquina: '99' }))).toBe('MAQUINA_NO_ENCONTRADA');
    const sinRespaldo = crear({ original: { ...original, respaldo: null } });
    expect(await codigoDe(sinRespaldo.devolver.execute(base))).toBe('SIN_RESPALDO');
  });
});
