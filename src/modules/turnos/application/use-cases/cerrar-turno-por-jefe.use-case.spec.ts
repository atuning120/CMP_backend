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
    cerrar: jest.fn<Promise<Turno | null>, [Turno, boolean, (string | null)?]>(async (t) => t),
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
    findByIdClienteCierre: jest.fn(async (_idCliente: string): Promise<Turno | null> => null),
    findUltimoRegistro: jest.fn(async (_idTurno: number): Promise<Date | null> => null),
    findCierre: jest.fn(async (_idTurno: number): Promise<{ por: string; fecha: Date } | null> => null),
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
    expect(turnoRepo.cerrar).toHaveBeenCalledWith(turno, false, null);
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
    expect(turnoRepo.cerrar).not.toHaveBeenCalled();

    const sinTurno = crear(null);
    expect(await codigoDe(sinTurno.cerrar.execute(base, ahora))).toBe('SIN_TURNO_EN_CURSO');
  });

  it('si el operador u otro jefe de turno lo cerró mientras tanto, gana el primer cierre', async () => {
    const { turnoRepo, cerrar } = crear(turnoDe(6));
    turnoRepo.cerrar.mockResolvedValueOnce(null);
    expect(await codigoDe(cerrar.execute(base, ahora))).toBe('SIN_TURNO_EN_CURSO');
  });
});

describe('CerrarTurnoPorJefeUseCase: cierre hecho sin señal (app)', () => {
  const idCliente = '7b1f6a0e-2c3d-4e5f-8a9b-0c1d2e3f4a5b';
  const sinSenal = { ...base, idTurno: 11, idCliente, fechaAccion: new Date(ahora.getTime() - 2 * HORA).toISOString() };
  const mensajeDe = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error: any) {
      return error.getResponse();
    }
    throw new Error('Se esperaba un error');
  };

  it('cierra el turno que vio, con la hora en que tomó el horómetro y su idCliente', async () => {
    const turno = turnoDe(6);
    const { turnoRepo, cerrar } = crear(null);
    turnoRepo.findById.mockResolvedValue(turno);

    await cerrar.execute(sinSenal, ahora);

    expect(turno.fechaFin).toEqual(new Date(sinSenal.fechaAccion));
    expect(turnoRepo.cerrar).toHaveBeenCalledWith(turno, false, idCliente);
  });

  it('el término no queda antes de lo último que registró el operador', async () => {
    const turno = turnoDe(6);
    const { turnoRepo, cerrar } = crear(null);
    turnoRepo.findById.mockResolvedValue(turno);
    const ultimoEstado = new Date(ahora.getTime() - HORA);
    turnoRepo.findUltimoRegistro.mockResolvedValue(ultimoEstado);

    await cerrar.execute(sinSenal, ahora);

    expect(turno.fechaFin).toEqual(ultimoEstado);
  });

  it('si ya estaba cerrado, dice quién lo cerró y a qué hora', async () => {
    const turno = turnoDe(6);
    turno.fechaFin = new Date('2030-01-01T13:05:00Z');
    turno.estadoActual = 'CERRADO';
    const { turnoRepo, cerrar } = crear(null);
    turnoRepo.findById.mockResolvedValue(turno);
    turnoRepo.findCierre.mockResolvedValue({ por: 'Cristian Núñez', fecha: turno.fechaFin });

    // 13:05 UTC = 10:05 en Chile (enero, horario de verano)
    expect(await mensajeDe(cerrar.execute(sinSenal, ahora))).toEqual({
      statusCode: 409,
      code: 'TURNO_YA_CERRADO',
      message: 'El turno ya fue cerrado por Cristian Núñez a las 10:05',
    });
    expect(turnoRepo.cerrar).not.toHaveBeenCalled();
  });

  it('si pierde la carrera al guardar, también dice quién ganó; otro día lleva la fecha', async () => {
    const { turnoRepo, cerrar } = crear(null);
    turnoRepo.findById.mockResolvedValue(turnoDe(6));
    turnoRepo.cerrar.mockResolvedValueOnce(null);
    turnoRepo.findCierre.mockResolvedValue({ por: 'Ana Rojas', fecha: new Date('2029-12-31T20:30:00Z') });

    expect((await mensajeDe(cerrar.execute(sinSenal, ahora))).message).toBe('El turno ya fue cerrado por Ana Rojas a las 17:30 del 31/12');
  });

  it('un reintento con el mismo idCliente responde con el cierre ya guardado', async () => {
    const turno = turnoDe(6);
    const { turnoRepo, cerrar } = crear(null);
    turnoRepo.findByIdClienteCierre.mockResolvedValue(turno);

    await expect(cerrar.execute(sinSenal, ahora)).resolves.toBe(turno);
    expect(turnoRepo.cerrar).not.toHaveBeenCalled();
  });

  it('no cierra un turno de otra máquina ni acepta datos inválidos', async () => {
    const { turnoRepo, cerrar } = crear(null);
    turnoRepo.findById.mockResolvedValue(new Turno(11, 4, 2, new Date(ahora.getTime() - HORA), null, 1000, null, 'EN_CURSO'));
    expect(await codigoDe(cerrar.execute(sinSenal, ahora))).toBe('TURNO_NO_ENCONTRADO');
    expect(await codigoDe(cerrar.execute({ ...sinSenal, idCliente: 'x' }, ahora))).toBe('ID_CLIENTE_INVALIDO');
    expect(await codigoDe(cerrar.execute({ ...sinSenal, fechaAccion: '2031-01-01T00:00:00Z' }, ahora))).toBe('FECHA_INVALIDA');
  });
});
