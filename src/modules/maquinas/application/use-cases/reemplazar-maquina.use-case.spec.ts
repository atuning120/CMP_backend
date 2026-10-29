import type { MaquinaFlota, MaquinaRepositoryPort, ReemplazoMaquina } from '../../domain/repositories/maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../../domain/repositories/modelo-maquina.repository.port';
import { ReemplazarMaquinaUseCase } from './reemplazar-maquina.use-case';

const maquina = (id: number, nombre: string, extra: Partial<MaquinaFlota> = {}): MaquinaFlota => ({
  idMaquina: id,
  nombre,
  marca: 'Komatsu',
  modelo: 'WA600-8',
  tipoMaquina: 'Cargador Frontal',
  estado: 'ACTIVA',
  patente: null,
  anio: null,
  numeroChasis: null,
  esContratista: false,
  operadorAsignado: null,
  motivoEstado: null,
  operadorActual: null,
  idTurnoActual: null,
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

const saliente = maquina(3, 'CF-03', { estado: 'BAJA', operadorAsignado: { idOperador: 1, nombre: 'Ana Soto' } });
const respaldo = maquina(9, 'CF-09', { estado: 'BAJA' });

const crear = (opciones: { enUso?: boolean } = {}) => {
  const flota = new Map([saliente, respaldo].map((m) => [m.idMaquina, m]));
  const maquinaRepo = {
    findById: jest.fn(),
    findActivas: jest.fn(),
    findFlota: jest.fn(),
    findFlotaById: jest.fn(async (id: number) => flota.get(id) ?? maquina(id, `NUEVA-${id}`)),
    findIdPorIdCliente: jest.fn(async (_idCliente: string): Promise<number | null> => null),
    existeAccionDeCliente: jest.fn(async (_idCliente: string): Promise<boolean> => false),
    existeNombre: jest.fn(async () => false),
    existePatente: jest.fn(async () => false),
    tieneTurnoEnCurso: jest.fn(async () => opciones.enUso ?? false),
    create: jest.fn(),
    actualizar: jest.fn(),
    findOperadoresAsignables: jest.fn(async () => []),
    findOperadorAsignable: jest.fn(async () => null),
    reemplazar: jest.fn(async (r: ReemplazoMaquina) => ('idMaquina' in r.entrante ? r.entrante.idMaquina : 21)),
    devolver: jest.fn(async () => undefined),
    findTipos: jest.fn(async () => ['Cargador Frontal']),
    findMarcas: jest.fn(async () => ['Komatsu']),
  } satisfies MaquinaRepositoryPort;
  const modeloRepo = {
    findActivos: jest.fn(),
    crearSiNoExiste: jest.fn(async () => undefined),
  } satisfies ModeloMaquinaRepositoryPort;
  return { maquinaRepo, reemplazar: new ReemplazarMaquinaUseCase(maquinaRepo, modeloRepo) };
};

const base = { rol: 'JEFE_TURNO', idUsuario: 7, idMaquina: '3', motivo: 'Falla mecánica' };
const registro = { idUsuario: 7, motivo: 'Falla mecánica', observacion: null };

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('ReemplazarMaquinaUseCase', () => {
  it('con una máquina de respaldo: la habilita y le pasa el operador de la saliente', async () => {
    const { maquinaRepo, reemplazar } = crear();
    const resultado = await reemplazar.execute({ ...base, idMaquinaEntrante: 9 });
    expect(maquinaRepo.reemplazar).toHaveBeenCalledWith({
      idSaliente: 3,
      // Ya estaba fuera de servicio: lo conserva. El respaldo recuerda su estado para la devolución
      estadoSaliente: 'BAJA',
      regresoEstimado: null,
      estadoPrevioEntrante: 'BAJA',
      entrante: { idMaquina: 9, habilitar: true },
      idOperador: 1,
      versiones: [
        { idMaquina: 3, version: 1 },
        { idMaquina: 9, version: 1 },
      ],
      accionesSaliente: [
        {
          ...registro,
          accion: 'REEMPLAZAR',
          detalle: { entrante: 'CF-09', operador: 'Ana Soto', antes: { estado: 'BAJA' }, despues: { estado: 'BAJA' } },
        },
      ],
      accionesEntrante: [
        { ...registro, accion: 'HABILITAR', detalle: { reemplazaA: 'CF-03', antes: { estado: 'BAJA' }, despues: { estado: 'ACTIVA' } } },
        { ...registro, accion: 'EDITAR', detalle: { antes: { operador: null }, despues: { operador: 'Ana Soto' } } },
      ],
      accionesOtras: [],
    });
    expect(resultado.entrante.nombre).toBe('CF-09');
  });

  it('con una máquina nueva: la crea con el operador elegido', async () => {
    const { maquinaRepo, reemplazar } = crear();
    maquinaRepo.findOperadorAsignable.mockResolvedValueOnce({
      idOperador: 4,
      nombre: 'Juan Pérez',
      rut: '1-9',
      maquinaAsignada: { idMaquina: 5, nombre: 'CF-05' },
    } as never);
    await reemplazar.execute({
      ...base,
      idOperador: 4,
      maquinaNueva: { nombre: 'cf-21', marca: 'Komatsu', modelo: 'WA600-8', tipoMaquina: 'Cargador Frontal', horometroInicial: 0 },
    });
    const llamada = maquinaRepo.reemplazar.mock.calls[0][0];
    expect(llamada.entrante).toEqual({ nueva: expect.objectContaining({ nombre: 'CF-21', horometroInicial: 0 }) });
    expect(llamada.idOperador).toBe(4);
    expect(llamada.accionesEntrante).toEqual([
      expect.objectContaining({ accion: 'INCORPORAR', detalle: expect.objectContaining({ reemplazaA: 'CF-03', operador: 'Juan Pérez' }) }),
    ]);
    // Juan dejó CF-05: queda registrado en esa máquina
    expect(llamada.accionesOtras).toEqual([expect.objectContaining({ idMaquina: 5, observacion: 'Juan Pérez pasó a CF-21' })]);
  });

  it('valida la entrante, el motivo y que la saliente no tenga un turno en curso', async () => {
    const { reemplazar } = crear();
    expect(await codigoDe(reemplazar.execute({ ...base, rol: 'OPERADOR', idMaquinaEntrante: 9 }))).toBe('SIN_PERMISO');
    expect(await codigoDe(reemplazar.execute({ ...base, motivo: '', idMaquinaEntrante: 9 }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(reemplazar.execute({ ...base }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(reemplazar.execute({ ...base, idMaquinaEntrante: 3 }))).toBe('DATOS_INVALIDOS');
    expect(
      await codigoDe(reemplazar.execute({ ...base, idMaquinaEntrante: 9, maquinaNueva: { nombre: 'X', horometroInicial: 0 } })),
    ).toBe('DATOS_INVALIDOS');
    const enUso = crear({ enUso: true });
    expect(await codigoDe(enUso.reemplazar.execute({ ...base, idMaquinaEntrante: 9 }))).toBe('MAQUINA_EN_USO');
  });

  it('reemplaza una máquina operativa en un paso: queda en mantenimiento con su regreso estimado', async () => {
    const { maquinaRepo, reemplazar } = crear();
    const operativa = maquina(3, 'BD-01', { estado: 'ACTIVA', operadorAsignado: { idOperador: 1, nombre: 'Ana Soto' } });
    const reserva = maquina(9, 'BD-05', { estado: 'EN_RESERVA' });
    maquinaRepo.findFlotaById.mockImplementation(async (id: number) => (id === 3 ? operativa : reserva));
    const regreso = new Date(Date.now() + 40 * 3600_000);

    await reemplazar.execute({ ...base, idMaquinaEntrante: 9, estadoSaliente: 'EN_MANTENIMIENTO', regresoEstimado: regreso.toISOString() });

    const [r] = maquinaRepo.reemplazar.mock.calls[0];
    expect(r).toMatchObject({ estadoSaliente: 'EN_MANTENIMIENTO', regresoEstimado: regreso, estadoPrevioEntrante: 'EN_RESERVA', idOperador: 1 });
    expect(r.accionesSaliente[0].detalle).toMatchObject({
      antes: { estado: 'ACTIVA' },
      despues: { estado: 'EN_MANTENIMIENTO', regresoEstimado: regreso.toISOString() },
    });
  });

  it('fuera de servicio no lleva regreso estimado', async () => {
    const { maquinaRepo, reemplazar } = crear();
    maquinaRepo.findFlotaById.mockImplementation(async (id: number) => (id === 3 ? maquina(3, 'BD-01') : respaldo));
    const regreso = new Date(Date.now() + 40 * 3600_000).toISOString();
    expect(await codigoDe(reemplazar.execute({ ...base, idMaquinaEntrante: 9, estadoSaliente: 'BAJA', regresoEstimado: regreso }))).toBe(
      'DATOS_INVALIDOS',
    );
    expect(maquinaRepo.reemplazar).not.toHaveBeenCalled();
  });

  it('sin estado indicado, una operativa queda fuera de servicio', async () => {
    const { maquinaRepo, reemplazar } = crear();
    maquinaRepo.findFlotaById.mockImplementation(async (id: number) => (id === 3 ? maquina(3, 'BD-01') : respaldo));
    await reemplazar.execute({ ...base, idMaquinaEntrante: 9 });
    expect(maquinaRepo.reemplazar.mock.calls[0][0].estadoSaliente).toBe('BAJA');
  });

  it('el respaldo tiene que poder trabajar y no estar cubriendo a otra; la saliente no puede tener ya un respaldo', async () => {
    const { maquinaRepo, reemplazar } = crear();
    const casos: [MaquinaFlota, MaquinaFlota][] = [
      [saliente, maquina(9, 'CF-09', { estado: 'EN_MANTENIMIENTO' })],
      [saliente, maquina(9, 'CF-09', { estado: 'EN_RESERVA', cubreA: { idMaquina: 4, nombre: 'CF-04' } })],
      [{ ...saliente, respaldo: { idMaquina: 6, nombre: 'CF-06', estadoAlDevolver: 'EN_RESERVA' } }, respaldo],
    ];
    for (const [sal, ent] of casos) {
      maquinaRepo.findFlotaById.mockImplementation(async (id: number) => (id === 3 ? sal : ent));
      expect(await codigoDe(reemplazar.execute({ ...base, idMaquinaEntrante: 9 }))).toBe('DATOS_INVALIDOS');
    }
    expect(await codigoDe(reemplazar.execute({ ...base, idMaquinaEntrante: 9, estadoSaliente: 'EN_RESERVA' }))).toBe('DATOS_INVALIDOS');
    expect(maquinaRepo.reemplazar).not.toHaveBeenCalled();
  });

  it('una entrante en reserva pasa a operativa', async () => {
    const { maquinaRepo, reemplazar } = crear();
    const reserva = maquina(8, 'CF-08', { estado: 'EN_RESERVA' });
    maquinaRepo.findFlotaById.mockImplementation(async (id: number) => (id === 8 ? reserva : id === 3 ? saliente : maquina(id, `X-${id}`)));
    await reemplazar.execute({ ...base, idMaquinaEntrante: 8 });
    const [r] = maquinaRepo.reemplazar.mock.calls[0];
    expect(r.entrante).toEqual({ idMaquina: 8, habilitar: true });
    expect(r.accionesEntrante[0]).toMatchObject({ accion: 'CAMBIAR_ESTADO', detalle: { antes: { estado: 'EN_RESERVA' }, despues: { estado: 'ACTIVA' } } });
  });

  it('sin operador si se envía null', async () => {
    const { maquinaRepo, reemplazar } = crear();
    await reemplazar.execute({ ...base, idMaquinaEntrante: 9, idOperador: null });
    expect(maquinaRepo.reemplazar.mock.calls[0][0].idOperador).toBeNull();
  });
});
