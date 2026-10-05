import { Turno } from '../../domain/entities/turno.entity';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import type { MaquinaRepositoryPort, MaquinaResumen } from '../../../maquinas/domain/repositories/maquina.repository.port';
import type {
  AreaResumen,
  GeocercaRepositoryPort,
  ZonaTrabajoResumen,
} from '../../../geocercas/domain/repositories/geocerca.repository.port';
import type { UbicacionTurno } from '../../domain/entities/ubicacion-turno';
import { ObtenerTurnoActualUseCase } from './obtener-turno-actual.use-case';
import { IniciarTurnoUseCase } from './iniciar-turno.use-case';
import { FinalizarTurnoUseCase } from './finalizar-turno.use-case';
import { CerrarTurnosExcedidosUseCase } from './cerrar-turnos-excedidos.use-case';

const HORA = 60 * 60 * 1000;
const ID_OPERADOR = 10;

const maquina: MaquinaResumen = {
  idMaquina: 20,
  nombre: 'CF-01',
  marca: 'Caterpillar',
  modelo: 'CAT 988K',
  tipoMaquina: 'Cargador Frontal',
  estado: 'ACTIVA',
};

const area: AreaResumen = { idArea: 3, nombre: 'Área 03 - Chancado', descripcion: null, estado: 'ACTIVA' };
const zona: ZonaTrabajoResumen = { idZona: 5, idArea: 3, nombre: 'Tolva 01', descripcion: null, estado: 'ACTIVA' };
const ubicacionValida = { idArea: area.idArea, idZona: zona.idZona };

const turnoIniciadoHace = (horas: number, overrides: Partial<Turno> = {}) =>
  Object.assign(
    new Turno(1, ID_OPERADOR, maquina.idMaquina, new Date(Date.now() - horas * HORA), null, 1000, null, 'EN_CURSO'),
    overrides,
  );

const crearRepos = () => {
  const turnoRepo = {
    save: jest.fn(async (turno: Turno) => Object.assign(turno, { id: turno.id ?? 99 })),
    iniciar: jest.fn(async (turno: Turno, _ubicacion: UbicacionTurno) => Object.assign(turno, { id: 99 })),
    findUbicacionVigente: jest.fn<Promise<UbicacionTurno | null>, [number]>(async () => ubicacionValida),
    findById: jest.fn<Promise<Turno | null>, [number]>(async () => null),
    findActivoByMaquina: jest.fn<Promise<Turno | null>, [number]>(async () => null),
    findActivoByOperador: jest.fn<Promise<Turno | null>, [number]>(async () => null),
    findUltimoByOperador: jest.fn<Promise<Turno | null>, [number]>(async () => null),
    findActivosIniciadosAntesDe: jest.fn<Promise<Turno[]>, [Date]>(async () => []),
  } satisfies TurnoRepositoryPort;
  const maquinaRepo = {
    findById: jest.fn<Promise<MaquinaResumen | null>, [number]>(async () => maquina),
    findActivas: jest.fn<Promise<MaquinaResumen[]>, []>(async () => [maquina]),
  } satisfies MaquinaRepositoryPort;
  const geocercaRepo = {
    findAreasActivas: jest.fn<Promise<AreaResumen[]>, []>(async () => [area]),
    findAreaById: jest.fn<Promise<AreaResumen | null>, [number]>(async (id) => (id === area.idArea ? area : null)),
    findZonasActivasByArea: jest.fn<Promise<ZonaTrabajoResumen[]>, [number]>(async () => [zona]),
    findZonaById: jest.fn<Promise<ZonaTrabajoResumen | null>, [number]>(async (id) => (id === zona.idZona ? zona : null)),
  } satisfies GeocercaRepositoryPort;
  return { turnoRepo, maquinaRepo, geocercaRepo };
};

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('ObtenerTurnoActualUseCase', () => {
  it('devuelve el turno en curso con su máquina (p. ej. al volver a iniciar sesión)', async () => {
    const { turnoRepo, maquinaRepo, geocercaRepo } = crearRepos();
    const turno = turnoIniciadoHace(3);
    turnoRepo.findActivoByOperador.mockResolvedValue(turno);

    const result = await new ObtenerTurnoActualUseCase(turnoRepo, maquinaRepo, geocercaRepo).execute(ID_OPERADOR);

    expect(result).toEqual({ turno, maquina, ubicacion: { area, zona }, turnoCerradoAutomaticamente: null });
    expect(turnoRepo.save.mock.calls).toHaveLength(0);
  });

  it('cierra automáticamente un turno de más de 12 h y lo informa', async () => {
    const { turnoRepo, maquinaRepo, geocercaRepo } = crearRepos();
    const turno = turnoIniciadoHace(13);
    turnoRepo.findActivoByOperador.mockResolvedValue(turno);
    turnoRepo.findUltimoByOperador.mockResolvedValue(turno);

    const result = await new ObtenerTurnoActualUseCase(turnoRepo, maquinaRepo, geocercaRepo).execute(ID_OPERADOR);

    expect(turno.estadoActual).toBe('CERRADO_AUTO');
    expect(turnoRepo.save.mock.calls).toContainEqual([turno]);
    expect(result.turno).toBeNull();
    expect(result.turnoCerradoAutomaticamente).toBe(turno);
  });

  it('sin turno activo y último turno cerrado normalmente no hay aviso', async () => {
    const { turnoRepo, maquinaRepo, geocercaRepo } = crearRepos();
    turnoRepo.findUltimoByOperador.mockResolvedValue(turnoIniciadoHace(20, { estadoActual: 'CERRADO', fechaFin: new Date() }));

    const result = await new ObtenerTurnoActualUseCase(turnoRepo, maquinaRepo, geocercaRepo).execute(ID_OPERADOR);

    expect(result).toEqual({ turno: null, maquina: null, ubicacion: null, turnoCerradoAutomaticamente: null });
  });
});

describe('IniciarTurnoUseCase', () => {
  it('crea un turno EN_CURSO junto a su área y zona', async () => {
    const { turnoRepo, maquinaRepo, geocercaRepo } = crearRepos();

    const result = await new IniciarTurnoUseCase(turnoRepo, maquinaRepo, geocercaRepo).execute({
      idOperador: ID_OPERADOR,
      idMaquina: maquina.idMaquina,
      horometroInicial: 1500,
      ...ubicacionValida,
    });

    expect(result.turno?.estadoActual).toBe('EN_CURSO');
    expect(result.turno?.horometroInicial).toBe(1500);
    expect(result.maquina).toBe(maquina);
    expect(result.ubicacion).toEqual({ area, zona });
    expect(turnoRepo.iniciar.mock.calls[0][1]).toEqual(ubicacionValida);
  });

  it('permite iniciar sin zona de trabajo', async () => {
    const { turnoRepo, maquinaRepo, geocercaRepo } = crearRepos();

    const result = await new IniciarTurnoUseCase(turnoRepo, maquinaRepo, geocercaRepo).execute({
      idOperador: ID_OPERADOR,
      idMaquina: 20,
      horometroInicial: 1,
      idArea: area.idArea,
      idZona: null,
    });

    expect(result.ubicacion).toEqual({ area, zona: null });
    expect(turnoRepo.iniciar.mock.calls[0][1]).toEqual({ idArea: area.idArea, idZona: null });
  });

  it('rechaza un área inexistente', async () => {
    const { turnoRepo, maquinaRepo, geocercaRepo } = crearRepos();

    const code = await codigoDe(
      new IniciarTurnoUseCase(turnoRepo, maquinaRepo, geocercaRepo).execute({
        idOperador: ID_OPERADOR, idMaquina: 20, horometroInicial: 1, idArea: 999, idZona: null,
      }),
    );
    expect(code).toBe('AREA_NO_DISPONIBLE');
  });

  it('rechaza una zona que no pertenece al área seleccionada', async () => {
    const { turnoRepo, maquinaRepo, geocercaRepo } = crearRepos();
    geocercaRepo.findZonaById.mockResolvedValue({ ...zona, idArea: 8 });

    const code = await codigoDe(
      new IniciarTurnoUseCase(turnoRepo, maquinaRepo, geocercaRepo).execute({
        idOperador: ID_OPERADOR, idMaquina: 20, horometroInicial: 1, ...ubicacionValida,
      }),
    );
    expect(code).toBe('ZONA_NO_DISPONIBLE');
    expect(turnoRepo.iniciar.mock.calls).toHaveLength(0);
  });

  it('rechaza iniciar si el operador ya tiene un turno en curso', async () => {
    const { turnoRepo, maquinaRepo, geocercaRepo } = crearRepos();
    turnoRepo.findActivoByOperador.mockResolvedValue(turnoIniciadoHace(2));

    const code = await codigoDe(
      new IniciarTurnoUseCase(turnoRepo, maquinaRepo, geocercaRepo).execute({ idOperador: ID_OPERADOR, idMaquina: 20, horometroInicial: 1, ...ubicacionValida }),
    );
    expect(code).toBe('OPERADOR_CON_TURNO_ACTIVO');
  });

  it('un turno olvidado de más de 12 h se cierra y no bloquea el nuevo inicio', async () => {
    const { turnoRepo, maquinaRepo, geocercaRepo } = crearRepos();
    const olvidado = turnoIniciadoHace(14);
    turnoRepo.findActivoByOperador.mockResolvedValue(olvidado);

    const result = await new IniciarTurnoUseCase(turnoRepo, maquinaRepo, geocercaRepo).execute({
      idOperador: ID_OPERADOR,
      idMaquina: 20,
      horometroInicial: 1100,
      ...ubicacionValida,
    });

    expect(olvidado.estadoActual).toBe('CERRADO_AUTO');
    expect(result.turno?.estadoActual).toBe('EN_CURSO');
  });

  it('rechaza una máquina dada de baja', async () => {
    const { turnoRepo, maquinaRepo, geocercaRepo } = crearRepos();
    maquinaRepo.findById.mockResolvedValue({ ...maquina, estado: 'BAJA' });

    const code = await codigoDe(
      new IniciarTurnoUseCase(turnoRepo, maquinaRepo, geocercaRepo).execute({ idOperador: ID_OPERADOR, idMaquina: 20, horometroInicial: 1, ...ubicacionValida }),
    );
    expect(code).toBe('MAQUINA_NO_DISPONIBLE');
  });
});

describe('FinalizarTurnoUseCase', () => {
  it('cierra el turno propio como CERRADO', async () => {
    const { turnoRepo } = crearRepos();
    turnoRepo.findById.mockResolvedValue(turnoIniciadoHace(8));

    const turno = await new FinalizarTurnoUseCase(turnoRepo).execute({ idOperador: ID_OPERADOR, idTurno: 1, horometroFinal: 1008 });

    expect(turno.estadoActual).toBe('CERRADO');
    expect(turno.horometroFinal).toBe(1008);
  });

  it('no permite cerrar el turno de otro operador', async () => {
    const { turnoRepo } = crearRepos();
    turnoRepo.findById.mockResolvedValue(turnoIniciadoHace(8));

    const code = await codigoDe(new FinalizarTurnoUseCase(turnoRepo).execute({ idOperador: 999, idTurno: 1, horometroFinal: 1008 }));
    expect(code).toBe('TURNO_NO_ENCONTRADO');
  });

  it('si el turno pasó las 12 h lo cierra automáticamente en vez de con el horómetro', async () => {
    const { turnoRepo } = crearRepos();
    const turno = turnoIniciadoHace(13);
    turnoRepo.findById.mockResolvedValue(turno);

    const code = await codigoDe(new FinalizarTurnoUseCase(turnoRepo).execute({ idOperador: ID_OPERADOR, idTurno: 1, horometroFinal: 1013 }));

    expect(code).toBe('TURNO_CERRADO_AUTOMATICAMENTE');
    expect(turno.estadoActual).toBe('CERRADO_AUTO');
    expect(turnoRepo.save.mock.calls).toContainEqual([turno]);
  });
});

describe('CerrarTurnosExcedidosUseCase', () => {
  it('cierra todos los turnos abiertos iniciados hace más de 12 h', async () => {
    const { turnoRepo } = crearRepos();
    const ahora = new Date();
    const excedidos = [turnoIniciadoHace(13), turnoIniciadoHace(30)];
    turnoRepo.findActivosIniciadosAntesDe.mockResolvedValue(excedidos);

    const cerrados = await new CerrarTurnosExcedidosUseCase(turnoRepo).execute(ahora);

    expect(turnoRepo.findActivosIniciadosAntesDe.mock.calls).toEqual([[new Date(ahora.getTime() - 12 * HORA)]]);
    expect(cerrados).toHaveLength(2);
    expect(cerrados.every((t) => t.estadoActual === 'CERRADO_AUTO')).toBe(true);
  });
});
