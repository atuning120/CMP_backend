import { Turno } from '../../domain/entities/turno.entity';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import type {
  EstadoOperacionalResumen,
  TurnoEstadoRegistro,
  TurnoEstadoRepositoryPort,
} from '../../domain/repositories/turno-estado.repository.port';
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
import { RegistrarEstadoUseCase } from './registrar-estado.use-case';

const HORA = 60 * 60 * 1000;
const ID_OPERADOR = 10;
const UUID_TURNO = '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7';
const UUID_ESTADO = '0a1b2c3d-4e5f-4061-8273-8495a6b7c8d9';

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
const produccion: EstadoOperacionalResumen = { idEstado: 1, nombre: 'Producción', categoria: 'PRODUCTIVO', esProductivo: true, activo: true, descripcion: 'Carguío' };

const turnoIniciadoHace = (horas: number, overrides: Partial<Turno> = {}) =>
  Object.assign(
    new Turno(1, ID_OPERADOR, maquina.idMaquina, new Date(Date.now() - horas * HORA), null, 1000, null, 'EN_CURSO', UUID_TURNO),
    overrides,
  );

const crearRepos = () => {
  const turnoRepo = {
    save: jest.fn(async (turno: Turno) => Object.assign(turno, { id: turno.id ?? 99 })),
    iniciar: jest.fn(async (turno: Turno, _ubicacion: UbicacionTurno) => Object.assign(turno, { id: 99 })),
    findUbicacionVigente: jest.fn<Promise<UbicacionTurno | null>, [number]>(async () => ubicacionValida),
    findById: jest.fn<Promise<Turno | null>, [number]>(async () => null),
    findByIdCliente: jest.fn<Promise<Turno | null>, [string]>(async () => null),
    findActivoByMaquina: jest.fn<Promise<Turno | null>, [number]>(async () => null),
    findActivoByOperador: jest.fn<Promise<Turno | null>, [number]>(async () => null),
    findUltimoByOperador: jest.fn<Promise<Turno | null>, [number]>(async () => null),
    findActivosIniciadosAntesDe: jest.fn<Promise<Turno[]>, [Date]>(async () => []),
  } satisfies TurnoRepositoryPort;
  const maquinaRepo = {
    findById: jest.fn<Promise<MaquinaResumen | null>, [number]>(async () => maquina),
    findActivas: jest.fn(async () => [{ ...maquina, idOperadorAsignado: null }]),
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
  const geocercaRepo = {
    findAreasActivas: jest.fn<Promise<AreaResumen[]>, []>(async () => [area]),
    findAreaById: jest.fn<Promise<AreaResumen | null>, [number]>(async (id) => (id === area.idArea ? area : null)),
    findZonasActivasByArea: jest.fn<Promise<ZonaTrabajoResumen[]>, [number]>(async () => [zona]),
    findZonasActivas: jest.fn<Promise<ZonaTrabajoResumen[]>, []>(async () => [zona]),
    findZonaById: jest.fn<Promise<ZonaTrabajoResumen | null>, [number]>(async (id) => (id === zona.idZona ? zona : null)),
  } satisfies GeocercaRepositoryPort;
  const turnoEstadoRepo = {
    findCatalogoActivo: jest.fn<Promise<EstadoOperacionalResumen[]>, []>(async () => [produccion]),
    findEstadoById: jest.fn<Promise<EstadoOperacionalResumen | null>, [number]>(async (id) => (id === 1 ? produccion : null)),
    findByIdCliente: jest.fn<Promise<TurnoEstadoRegistro | null>, [string]>(async () => null),
    findHistorial: jest.fn<Promise<TurnoEstadoRegistro[]>, [number]>(async () => []),
    registrarCambio: jest.fn(async (data: Omit<TurnoEstadoRegistro, 'idTurnoEstado'>) => ({ idTurnoEstado: 7, ...data })),
  } satisfies TurnoEstadoRepositoryPort;
  return { turnoRepo, maquinaRepo, geocercaRepo, turnoEstadoRepo };
};

const iniciar = (repos: ReturnType<typeof crearRepos>) =>
  new IniciarTurnoUseCase(repos.turnoRepo, repos.maquinaRepo, repos.geocercaRepo, repos.turnoEstadoRepo);
const obtener = (repos: ReturnType<typeof crearRepos>) =>
  new ObtenerTurnoActualUseCase(repos.turnoRepo, repos.maquinaRepo, repos.geocercaRepo, repos.turnoEstadoRepo);

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('ObtenerTurnoActualUseCase', () => {
  it('devuelve el turno en curso con su máquina, ubicación e historial de estados', async () => {
    const repos = crearRepos();
    const turno = turnoIniciadoHace(3);
    repos.turnoRepo.findActivoByOperador.mockResolvedValue(turno);
    const registro: TurnoEstadoRegistro = {
      idTurnoEstado: 7, idTurno: 1, idEstado: 1, inicio: turno.fechaInicio, fin: null, comentario: null, idCliente: UUID_ESTADO,
    };
    repos.turnoEstadoRepo.findHistorial.mockResolvedValue([registro]);

    const result = await obtener(repos).execute(ID_OPERADOR);

    expect(result).toEqual({
      turno,
      maquina,
      ubicacion: { area, zona },
      historialEstados: [{ ...registro, estado: produccion }],
      turnoCerradoAutomaticamente: null,
    });
    expect(repos.turnoRepo.save.mock.calls).toHaveLength(0);
  });

  it('cierra automáticamente un turno de más de 12 h y lo informa', async () => {
    const repos = crearRepos();
    const turno = turnoIniciadoHace(13);
    repos.turnoRepo.findActivoByOperador.mockResolvedValue(turno);
    repos.turnoRepo.findUltimoByOperador.mockResolvedValue(turno);

    const result = await obtener(repos).execute(ID_OPERADOR);

    expect(turno.estadoActual).toBe('CERRADO_AUTO');
    expect(repos.turnoRepo.save.mock.calls).toContainEqual([turno]);
    expect(result.turno).toBeNull();
    expect(result.turnoCerradoAutomaticamente).toBe(turno);
  });
});

describe('IniciarTurnoUseCase', () => {
  const datos = { idOperador: ID_OPERADOR, idMaquina: 20, horometroInicial: 1500, ...ubicacionValida };

  it('crea un turno EN_CURSO con la fecha real informada por la app y su idCliente', async () => {
    const repos = crearRepos();
    const fechaInicio = new Date(Date.now() - 2 * HORA);

    const result = await iniciar(repos).execute({ ...datos, idCliente: UUID_TURNO, fechaInicio: fechaInicio.toISOString() });

    expect(result.turno).toMatchObject({ estadoActual: 'EN_CURSO', idCliente: UUID_TURNO, fechaInicio, conflicto: false });
    expect(result.ubicacion).toEqual({ area, zona });
    expect(repos.turnoRepo.iniciar.mock.calls[0][1]).toEqual(ubicacionValida);
  });

  it('es idempotente: un reintento con el mismo idCliente no crea otro turno', async () => {
    const repos = crearRepos();
    const existente = turnoIniciadoHace(1);
    repos.turnoRepo.findByIdCliente.mockResolvedValue(existente);

    const result = await iniciar(repos).execute({ ...datos, idCliente: UUID_TURNO });

    expect(result.turno).toBe(existente);
    expect(repos.turnoRepo.iniciar.mock.calls).toHaveLength(0);
  });

  it('acepta y marca conflicto si la máquina ya tenía un turno abierto de otro operador', async () => {
    const repos = crearRepos();
    repos.turnoRepo.findActivoByMaquina.mockResolvedValue(turnoIniciadoHace(2, { id: 55, idOperador: 999 } as Partial<Turno>));

    const result = await iniciar(repos).execute({ ...datos, idCliente: UUID_TURNO });

    expect(result.turno?.conflicto).toBe(true);
    expect(result.turno?.conflictoDetalle).toContain('#55');
    expect(repos.turnoRepo.iniciar.mock.calls).toHaveLength(1);
  });

  it('acepta y marca conflicto si el operador ya tenía otro turno abierto', async () => {
    const repos = crearRepos();
    repos.turnoRepo.findActivoByOperador.mockResolvedValue(turnoIniciadoHace(2, { id: 44 } as Partial<Turno>));

    const result = await iniciar(repos).execute(datos);

    expect(result.turno?.conflicto).toBe(true);
    expect(result.turno?.conflictoDetalle).toContain('#44');
  });

  it('acepta una máquina dada de baja después del inicio offline, marcando conflicto', async () => {
    const repos = crearRepos();
    repos.maquinaRepo.findById.mockResolvedValue({ ...maquina, estado: 'BAJA' });

    const result = await iniciar(repos).execute(datos);

    expect(result.turno?.conflicto).toBe(true);
  });

  it('un turno olvidado de más de 12 h se cierra y no genera conflicto', async () => {
    const repos = crearRepos();
    const olvidado = turnoIniciadoHace(14);
    repos.turnoRepo.findActivoByOperador.mockResolvedValue(olvidado);

    const result = await iniciar(repos).execute(datos);

    expect(olvidado.estadoActual).toBe('CERRADO_AUTO');
    expect(result.turno?.conflicto).toBe(false);
  });

  it('rechaza datos imposibles de guardar: máquina o área inexistente, zona de otra área, fecha futura', async () => {
    const repos = crearRepos();
    repos.maquinaRepo.findById.mockResolvedValueOnce(null);
    expect(await codigoDe(iniciar(repos).execute(datos))).toBe('MAQUINA_NO_DISPONIBLE');
    expect(await codigoDe(iniciar(repos).execute({ ...datos, idArea: 999 }))).toBe('AREA_NO_DISPONIBLE');
    repos.geocercaRepo.findZonaById.mockResolvedValueOnce({ ...zona, idArea: 8 });
    expect(await codigoDe(iniciar(repos).execute(datos))).toBe('ZONA_NO_DISPONIBLE');
    const futuro = new Date(Date.now() + HORA).toISOString();
    expect(await codigoDe(iniciar(repos).execute({ ...datos, fechaInicio: futuro }))).toBe('FECHA_INVALIDA');
    expect(await codigoDe(iniciar(repos).execute({ ...datos, idCliente: 'no-es-uuid' }))).toBe('ID_CLIENTE_INVALIDO');
    expect(repos.turnoRepo.iniciar.mock.calls).toHaveLength(0);
  });
});

describe('FinalizarTurnoUseCase', () => {
  it('cierra el turno propio (identificado por idCliente) con la fecha real del cierre', async () => {
    const repos = crearRepos();
    const turno = turnoIniciadoHace(8);
    repos.turnoRepo.findByIdCliente.mockResolvedValue(turno);
    const fechaFin = new Date(Date.now() - HORA);

    const cerrado = await new FinalizarTurnoUseCase(repos.turnoRepo).execute({
      idOperador: ID_OPERADOR, idClienteTurno: UUID_TURNO, horometroFinal: 1008, fechaFin: fechaFin.toISOString(),
    });

    expect(cerrado).toMatchObject({ estadoActual: 'CERRADO', horometroFinal: 1008, fechaFin });
  });

  it('es idempotente: un turno ya CERRADO se devuelve sin cambios', async () => {
    const repos = crearRepos();
    const turno = turnoIniciadoHace(8, { estadoActual: 'CERRADO', fechaFin: new Date(), horometroFinal: 1008 });
    repos.turnoRepo.findById.mockResolvedValue(turno);

    const cerrado = await new FinalizarTurnoUseCase(repos.turnoRepo).execute({ idOperador: ID_OPERADOR, idTurno: 1, horometroFinal: 2000 });

    expect(cerrado.horometroFinal).toBe(1008);
    expect(repos.turnoRepo.save.mock.calls).toHaveLength(0);
  });

  it('no permite cerrar el turno de otro operador', async () => {
    const repos = crearRepos();
    repos.turnoRepo.findById.mockResolvedValue(turnoIniciadoHace(8));

    const code = await codigoDe(new FinalizarTurnoUseCase(repos.turnoRepo).execute({ idOperador: 999, idTurno: 1, horometroFinal: 1008 }));
    expect(code).toBe('TURNO_NO_ENCONTRADO');
  });

  it('corrige un cierre automático del servidor cuando llega el cierre real hecho offline dentro de las 12 h', async () => {
    const repos = crearRepos();
    const turno = turnoIniciadoHace(20);
    turno.cerrarAutomaticamente(); // el servidor lo cerró porque el cierre offline aún no llegaba
    repos.turnoRepo.findByIdCliente.mockResolvedValue(turno);
    const fechaFinReal = new Date(turno.fechaInicio.getTime() + 9 * HORA);

    const cerrado = await new FinalizarTurnoUseCase(repos.turnoRepo).execute({
      idOperador: ID_OPERADOR, idClienteTurno: UUID_TURNO, horometroFinal: 1009, fechaFin: fechaFinReal.toISOString(),
    });

    expect(cerrado).toMatchObject({ estadoActual: 'CERRADO', fechaFin: fechaFinReal, horometroFinal: 1009 });
  });

  it('un cierre después de las 12 h queda CERRADO_AUTO en el límite, conservando el horómetro', async () => {
    const repos = crearRepos();
    const turno = turnoIniciadoHace(13);
    repos.turnoRepo.findById.mockResolvedValue(turno);

    const cerrado = await new FinalizarTurnoUseCase(repos.turnoRepo).execute({ idOperador: ID_OPERADOR, idTurno: 1, horometroFinal: 1013 });

    expect(cerrado).toMatchObject({ estadoActual: 'CERRADO_AUTO', horometroFinal: 1013, fechaFin: turno.limiteCierreAutomatico });
  });
});

describe('RegistrarEstadoUseCase', () => {
  it('registra el cambio con la fecha real y es idempotente por idCliente', async () => {
    const repos = crearRepos();
    const turno = turnoIniciadoHace(3);
    repos.turnoRepo.findByIdCliente.mockResolvedValue(turno);
    const inicio = new Date(Date.now() - HORA);
    const useCase = new RegistrarEstadoUseCase(repos.turnoRepo, repos.turnoEstadoRepo);
    const dto = { idOperador: ID_OPERADOR, idClienteTurno: UUID_TURNO, idCliente: UUID_ESTADO, idEstado: 1, inicio: inicio.toISOString() };

    const registro = await useCase.execute(dto);
    expect(registro).toMatchObject({ idTurno: 1, idEstado: 1, inicio, idCliente: UUID_ESTADO });

    repos.turnoEstadoRepo.findByIdCliente.mockResolvedValue(registro);
    await useCase.execute(dto);
    expect(repos.turnoEstadoRepo.registrarCambio.mock.calls).toHaveLength(1);
  });

  it('acepta un cambio offline que llega después del cierre si ocurrió durante el turno', async () => {
    const repos = crearRepos();
    const turno = turnoIniciadoHace(8);
    turno.finalizar(new Date(Date.now() - HORA), 1008);
    repos.turnoRepo.findByIdCliente.mockResolvedValue(turno);
    const useCase = new RegistrarEstadoUseCase(repos.turnoRepo, repos.turnoEstadoRepo);

    const registro = await useCase.execute({
      idOperador: ID_OPERADOR, idClienteTurno: UUID_TURNO, idCliente: UUID_ESTADO, idEstado: 1, inicio: new Date(Date.now() - 2 * HORA).toISOString(),
    });
    expect(registro.fin).toEqual(turno.fechaFin);

    const code = await codigoDe(
      useCase.execute({ idOperador: ID_OPERADOR, idClienteTurno: UUID_TURNO, idCliente: UUID_TURNO, idEstado: 1 }),
    );
    expect(code).toBe('TURNO_NO_ACTIVO');
  });

  it('rechaza un estado inexistente', async () => {
    const repos = crearRepos();
    repos.turnoRepo.findByIdCliente.mockResolvedValue(turnoIniciadoHace(1));
    const code = await codigoDe(
      new RegistrarEstadoUseCase(repos.turnoRepo, repos.turnoEstadoRepo).execute({
        idOperador: ID_OPERADOR, idClienteTurno: UUID_TURNO, idCliente: UUID_ESTADO, idEstado: 999,
      }),
    );
    expect(code).toBe('ESTADO_NO_DISPONIBLE');
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
