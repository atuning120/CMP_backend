import type { AtencionAlerta } from '../../domain/repositories/alerta-turno.repository.port';
import type { AtencionAlertaRepositoryPort } from '../../domain/repositories/atencion-alerta.repository.port';
import type {
  Regularizacion,
  RegularizacionHorometroRepositoryPort,
  TurnoARegularizar,
} from '../../domain/repositories/regularizacion-horometro.repository.port';
import type { PublicadorAlertasPort } from '../ports/publicador-alertas.port';
import { RegularizarHorometroUseCase } from './regularizar-horometro.use-case';

const JEFE = { idUsuario: 4, rol: 'JEFE_TURNO' };
const UUID = '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7';
const AHORA = new Date('2026-11-05T12:00:00Z');
const atencion: AtencionAlerta = { usuario: 'Jefe de turno 1', fecha: AHORA, comentario: 'Horómetro final regularizado: 1010 h' };

const turnoBase: TurnoARegularizar = {
  idTurno: 31,
  operador: 'Operador 1',
  horometroInicial: 1000,
  horometroFinal: null,
  horometroSiguiente: null,
};

const crear = (turno: TurnoARegularizar | null = turnoBase, { guarda = true, existeUuid = false } = {}) => {
  const regularizacionRepo = {
    turnoCerradoAutomaticamente: jest.fn(async () => turno),
    existeIdCliente: jest.fn(async () => existeUuid),
    regularizar: jest.fn(async (_datos: Regularizacion) => guarda),
  } satisfies RegularizacionHorometroRepositoryPort;
  const atencionRepo = {
    registrar: jest.fn(),
    existeIdCliente: jest.fn(),
    listar: jest.fn(async () => [atencion]),
  } satisfies AtencionAlertaRepositoryPort;
  const publicador = { publicar: jest.fn(), publicarAtencion: jest.fn() } satisfies PublicadorAlertasPort;
  return { regularizacionRepo, publicador, regularizar: new RegularizarHorometroUseCase(regularizacionRepo, atencionRepo, publicador) };
};

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

const datos = (overrides: Record<string, unknown> = {}) => ({ idAlerta: 'A-31', horometroFinal: 1010, autor: JEFE, ...overrides });

describe('RegularizarHorometroUseCase', () => {
  it('guarda el horómetro, deja la alerta atendida y avisa a los paneles abiertos', async () => {
    const { regularizacionRepo, publicador, regularizar } = crear();

    const resultado = await regularizar.execute(datos({ comentario: '  Lectura en cabina  ', idCliente: UUID }), AHORA);

    expect(regularizacionRepo.regularizar).toHaveBeenCalledWith({
      idTurno: 31,
      idAlerta: 'A-31',
      idUsuario: 4,
      horometroFinal: 1010,
      comentarioAtencion: 'Horómetro final regularizado: 1010 h. Lectura en cabina',
      observacion: 'Lectura en cabina',
      idCliente: UUID,
      fecha: null,
    });
    expect(resultado).toEqual({ idAlerta: 'A-31', atenciones: [atencion], horometroFinal: 1010 });
    expect(publicador.publicarAtencion).toHaveBeenCalledWith(resultado);
  });

  it('solo pueden hacerlo un jefe de turno o un administrador', async () => {
    const { regularizar } = crear();
    expect(await codigoDe(regularizar.execute(datos({ autor: { idUsuario: 9, rol: 'OPERADOR' } }), AHORA))).toBe('SIN_PERMISO');
  });

  it.each(['E-31', 'J-31', 'M-31', 'A-x'])('rechaza la alerta %s: solo aplica a cierres automáticos', async (idAlerta) => {
    const { regularizar } = crear();
    expect(await codigoDe(regularizar.execute(datos({ idAlerta }), AHORA))).toBe('ALERTA_NO_ENCONTRADA');
  });

  it('rechaza un turno que no fue cerrado automáticamente', async () => {
    const { regularizar } = crear(null);
    expect(await codigoDe(regularizar.execute(datos(), AHORA))).toBe('ALERTA_NO_ENCONTRADA');
  });

  it.each([['1010'], [Number.NaN], [-1], [100_000_000], [null]])('rechaza el horómetro %s', async (horometroFinal) => {
    const { regularizar } = crear();
    expect(await codigoDe(regularizar.execute(datos({ horometroFinal }), AHORA))).toBe('HOROMETRO_INVALIDO');
  });

  it('no puede ser menor que el horómetro inicial del turno', async () => {
    const { regularizacionRepo, regularizar } = crear();
    expect(await codigoDe(regularizar.execute(datos({ horometroFinal: 999 }), AHORA))).toBe('HOROMETRO_FUERA_DE_RANGO');
    expect(regularizacionRepo.regularizar).not.toHaveBeenCalled();
  });

  it('no puede ser mayor que el horómetro inicial del turno siguiente', async () => {
    const { regularizar } = crear({ ...turnoBase, horometroSiguiente: 1005 });
    expect(await codigoDe(regularizar.execute(datos({ horometroFinal: 1005.5 }), AHORA))).toBe('HOROMETRO_FUERA_DE_RANGO');
    await expect(regularizar.execute(datos({ horometroFinal: 1005 }), AHORA)).resolves.toMatchObject({ horometroFinal: 1005 });
  });

  it('ignora un turno siguiente con un inicial menor que este: es un error de tipeo y no sirve como máximo', async () => {
    const { regularizar } = crear({ ...turnoBase, horometroSiguiente: 100 });
    await expect(regularizar.execute(datos(), AHORA)).resolves.toMatchObject({ horometroFinal: 1010 });
  });

  it('no sobrescribe un horómetro ya informado', async () => {
    const { regularizacionRepo, regularizar } = crear({ ...turnoBase, horometroFinal: 1008 });
    expect(await codigoDe(regularizar.execute(datos(), AHORA))).toBe('HOROMETRO_YA_INFORMADO');
    expect(regularizacionRepo.regularizar).not.toHaveBeenCalled();
  });

  it('un reintento ya guardado responde lo que quedó, sin repetirla ni volver a avisar', async () => {
    const { regularizacionRepo, publicador, regularizar } = crear({ ...turnoBase, horometroFinal: 1008 }, { existeUuid: true });

    const resultado = await regularizar.execute(datos({ idCliente: UUID }), AHORA);

    expect(resultado.horometroFinal).toBe(1008);
    expect(regularizacionRepo.regularizar).not.toHaveBeenCalled();
    expect(publicador.publicarAtencion).not.toHaveBeenCalled();
  });

  it('si otro la regulariza entremedio, gana el primero', async () => {
    const { regularizar, publicador } = crear(turnoBase, { guarda: false });
    expect(await codigoDe(regularizar.execute(datos(), AHORA))).toBe('HOROMETRO_YA_INFORMADO');
    expect(publicador.publicarAtencion).not.toHaveBeenCalled();
  });

  it('una regularización hecha sin señal conserva su fecha, salvo que tenga más de 72 h', async () => {
    const { regularizacionRepo, regularizar } = crear();
    const fechaAccion = new Date(AHORA.getTime() - 2 * 60 * 60 * 1000).toISOString();

    await regularizar.execute(datos({ fechaAccion }), AHORA);
    expect(regularizacionRepo.regularizar.mock.calls[0][0].fecha).toEqual(new Date(fechaAccion));

    const vencida = new Date(AHORA.getTime() - 73 * 60 * 60 * 1000).toISOString();
    expect(await codigoDe(regularizar.execute(datos({ fechaAccion: vencida }), AHORA))).toBe('ACCION_VENCIDA');
  });
});
