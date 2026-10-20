import { DURACION_MAXIMA_TURNO_HORAS, Turno } from '../../domain/entities/turno.entity';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import { CerrarTurnoPorJefeUseCase } from './cerrar-turno-por-jefe.use-case';

const HORA = 60 * 60 * 1000;
const ahora = new Date('2030-01-01T15:00:00Z');
const turnoDe = (horasAbierto: number) =>
  new Turno(11, 4, 1, new Date(ahora.getTime() - horasAbierto * HORA), null, 1000, null, 'EN_CURSO', 'b8c0c2a2-6e43-4c8f-9a5e-0f6c1d2b3a40');

const crear = (turno: Turno | null) => {
  const turnoRepo = {
    save: jest.fn(async (t: Turno) => t),
    iniciar: jest.fn(),
    findById: jest.fn(),
    findByIdCliente: jest.fn(),
    findActivoByMaquina: jest.fn(async () => turno),
    findActivoByOperador: jest.fn(),
    findUltimoByOperador: jest.fn(),
    findActivosIniciadosAntesDe: jest.fn(),
    findUbicacionVigente: jest.fn(),
    findUbicacionByIdCliente: jest.fn(),
    registrarUbicacion: jest.fn(),
    findUltimoHorometroFinal: jest.fn(),
  } satisfies TurnoRepositoryPort;
  return { turnoRepo, cerrar: new CerrarTurnoPorJefeUseCase(turnoRepo) };
};

const base = { rol: 'JEFE_TURNO', idUsuario: 7, idMaquina: '1', horometroFinal: 1006, motivo: 'Falla mecánica' };

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('CerrarTurnoPorJefeUseCase', () => {
  it('cierra el turno en curso de la máquina con el horómetro y deja quién y por qué', async () => {
    const turno = turnoDe(6);
    const { turnoRepo, cerrar } = crear(turno);

    await cerrar.execute(base, ahora);

    expect(turno).toMatchObject({ estadoActual: 'CERRADO', fechaFin: ahora, horometroFinal: 1006, cerradoPor: 7, motivoCierre: 'Falla mecánica' });
    expect(turnoRepo.save).toHaveBeenCalledWith(turno);
  });

  it('un turno que ya pasó el límite queda CERRADO_AUTO en el límite, con el horómetro', async () => {
    const turno = turnoDe(DURACION_MAXIMA_TURNO_HORAS + 2);
    const { cerrar } = crear(turno);
    await cerrar.execute(base, ahora);
    expect(turno).toMatchObject({ estadoActual: 'CERRADO_AUTO', fechaFin: turno.limiteCierreAutomatico, horometroFinal: 1006, cerradoPor: 7 });
  });

  it('valida permiso, motivo, horómetro y que haya un turno en curso', async () => {
    const { turnoRepo, cerrar } = crear(turnoDe(2));
    expect(await codigoDe(cerrar.execute({ ...base, rol: 'OPERADOR' }, ahora))).toBe('SIN_PERMISO_CIERRE');
    expect(await codigoDe(cerrar.execute({ ...base, motivo: '' }, ahora))).toBe('MOTIVO_INVALIDO');
    expect(await codigoDe(cerrar.execute({ ...base, motivo: 'x'.repeat(101) }, ahora))).toBe('MOTIVO_INVALIDO');
    expect(await codigoDe(cerrar.execute({ ...base, horometroFinal: 999 }, ahora))).toBe('HOROMETRO_INVALIDO');
    expect(await codigoDe(cerrar.execute({ ...base, horometroFinal: '1006' }, ahora))).toBe('HOROMETRO_INVALIDO');
    expect(turnoRepo.save).not.toHaveBeenCalled();

    const sinTurno = crear(null);
    expect(await codigoDe(sinTurno.cerrar.execute(base, ahora))).toBe('SIN_TURNO_EN_CURSO');
  });
});
