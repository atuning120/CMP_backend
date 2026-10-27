import type { MaquinaRepositoryPort, NuevaMaquina } from '../../domain/repositories/maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../../domain/repositories/modelo-maquina.repository.port';
import { CrearMaquinaUseCase } from './crear-maquina.use-case';

const crear = (existentes: { nombres?: string[]; patentes?: string[]; tipos?: string[]; marcas?: string[] } = {}) => {
  const maquinaRepo = {
    findById: jest.fn(),
    findActivas: jest.fn(),
    findFlota: jest.fn(),
    findFlotaById: jest.fn(),
    findIdPorIdCliente: jest.fn(async (_idCliente: string): Promise<number | null> => null),
    existeAccionDeCliente: jest.fn(async (_idCliente: string) => false),
    tieneTurnoEnCurso: jest.fn(),
    actualizar: jest.fn(),
    existeNombre: jest.fn(async (nombre: string) => (existentes.nombres ?? []).includes(nombre)),
    existePatente: jest.fn(async (patente: string) => (existentes.patentes ?? []).includes(patente)),
    create: jest.fn(async (datos: NuevaMaquina) => ({
      idMaquina: 21,
      nombre: datos.nombre,
      marca: datos.marca,
      modelo: datos.modelo,
      tipoMaquina: datos.tipoMaquina,
      estado: 'ACTIVA',
      patente: datos.patente,
      anio: datos.anio,
      numeroChasis: datos.numeroChasis,
      esContratista: datos.esContratista,
      operadorAsignado: null,
      motivoEstado: null,
      operadorActual: null,
      estadoOperacional: null,
      ubicacionActual: null,
      idAreaActual: null,
      idZonaActual: null,
      horometroActual: datos.horometroInicial,
      regresoEstimado: null,
      respaldo: null,
      cubreA: null,
      version: 1,
      actualizadoEn: null,
      actualizadoPor: null,
    })),
    findTipos: jest.fn(async () => existentes.tipos ?? ['Cargador Frontal']),
    findOperadoresAsignables: jest.fn(async () => []),
    findOperadorAsignable: jest.fn(async () => null),
    reemplazar: jest.fn(async () => 0),
    devolver: jest.fn(async () => undefined),
    findMarcas: jest.fn(async () => existentes.marcas ?? ['Komatsu']),
  } satisfies MaquinaRepositoryPort;
  const modeloRepo = {
    findActivos: jest.fn(),
    crearSiNoExiste: jest.fn(async () => undefined),
  } satisfies ModeloMaquinaRepositoryPort;
  return { maquinaRepo, modeloRepo, crearMaquina: new CrearMaquinaUseCase(maquinaRepo, modeloRepo) };
};

const base = { rol: 'JEFE_TURNO', idUsuario: 7, motivo: 'Aumento de capacidad', nombre: ' cf-06 ', marca: 'Komatsu', modelo: 'WA600-8', tipoMaquina: 'Cargador Frontal', horometroInicial: 12.5 };

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('CrearMaquinaUseCase', () => {
  it('crea la máquina normalizando código y patente', async () => {
    const { maquinaRepo, crearMaquina } = crear();
    await crearMaquina.execute({ ...base, patente: 'ab-cd-12', numeroChasis: '  ', anio: '2024', esContratista: true });
    expect(maquinaRepo.create).toHaveBeenCalledWith({
      nombre: 'CF-06',
      marca: 'Komatsu',
      modelo: 'WA600-8',
      anio: 2024,
      tipoMaquina: 'Cargador Frontal',
      patente: 'AB-CD-12',
      numeroChasis: null,
      horometroInicial: 12.5,
      esContratista: true,
      idOperador: null,
      idCliente: null,
    }, { idUsuario: 7, motivo: 'Aumento de capacidad', observacion: null }, []);
  });

  it('un reintento con el mismo idCliente devuelve la máquina ya creada sin duplicarla', async () => {
    const { maquinaRepo, crearMaquina } = crear({ nombres: ['CF-06'] });
    const idCliente = '7b1f6a0e-2c3d-4e5f-8a9b-0c1d2e3f4a5b';
    maquinaRepo.findIdPorIdCliente.mockResolvedValue(21);
    maquinaRepo.findFlotaById.mockResolvedValue({ idMaquina: 21, nombre: 'CF-06' } as never);

    // Aunque el código ya exista (es la misma máquina), no responde CODIGO_DUPLICADO
    await expect(crearMaquina.execute({ ...base, idCliente: idCliente.toUpperCase() })).resolves.toMatchObject({ idMaquina: 21 });
    expect(maquinaRepo.findIdPorIdCliente).toHaveBeenCalledWith(idCliente);
    expect(maquinaRepo.create).not.toHaveBeenCalled();
    expect(await codigoDe(crearMaquina.execute({ ...base, idCliente: 'no-es-uuid' }))).toBe('DATOS_INVALIDOS');
  });

  it('guarda el idCliente; si choca con un reintento simultáneo, responde con la del otro', async () => {
    const { maquinaRepo, crearMaquina } = crear();
    const idCliente = '7b1f6a0e-2c3d-4e5f-8a9b-0c1d2e3f4a5b';
    await crearMaquina.execute({ ...base, idCliente });
    expect(maquinaRepo.create).toHaveBeenCalledWith(expect.objectContaining({ idCliente }), expect.anything(), []);

    maquinaRepo.create.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
    maquinaRepo.findIdPorIdCliente.mockResolvedValueOnce(null).mockResolvedValueOnce(21);
    maquinaRepo.findFlotaById.mockResolvedValueOnce({ idMaquina: 21, nombre: 'CF-06' } as never);
    await expect(crearMaquina.execute({ ...base, idCliente })).resolves.toMatchObject({ idMaquina: 21 });
  });

  it('si otro jefe movió al operador que se asigna, es conflicto', async () => {
    const { maquinaRepo, crearMaquina } = crear();
    maquinaRepo.findOperadorAsignable.mockResolvedValue({ idOperador: 4, nombre: 'Juan Pérez', rut: '1-9', maquinaAsignada: null } as never);
    expect(await codigoDe(crearMaquina.execute({ ...base, idOperador: 4, valoresBase: { maquinaOperador: 2 } }))).toBe('MAQUINA_MODIFICADA');
    expect(maquinaRepo.create).not.toHaveBeenCalled();
  });

  it('solo un jefe de turno o administrador puede crear', async () => {
    const { crearMaquina } = crear();
    expect(await codigoDe(crearMaquina.execute({ ...base, rol: 'OPERADOR' }))).toBe('SIN_PERMISO');
    expect(await codigoDe(crearMaquina.execute({ ...base, idUsuario: undefined }))).toBe('SIN_PERMISO');
    await expect(crearMaquina.execute({ ...base, rol: 'ADMIN' })).resolves.toBeDefined();
  });

  it('rechaza datos obligatorios faltantes o inválidos', async () => {
    const { maquinaRepo, crearMaquina } = crear();
    expect(await codigoDe(crearMaquina.execute({ ...base, nombre: '   ' }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(crearMaquina.execute({ ...base, motivo: '  ' }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(crearMaquina.execute({ ...base, observacion: 'x'.repeat(501) }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(crearMaquina.execute({ ...base, horometroInicial: -1 }))).toBe('HOROMETRO_INVALIDO');
    expect(await codigoDe(crearMaquina.execute({ ...base, horometroInicial: '' }))).toBe('HOROMETRO_INVALIDO');
    expect(await codigoDe(crearMaquina.execute({ ...base, anio: 1800 }))).toBe('ANIO_INVALIDO');
    expect(await codigoDe(crearMaquina.execute({ ...base, patente: 'X'.repeat(16) }))).toBe('DATOS_INVALIDOS');
    expect(maquinaRepo.create).not.toHaveBeenCalled();
  });

  it('no permite repetir código ni patente', async () => {
    const { crearMaquina } = crear({ nombres: ['CF-06'], patentes: ['AB-CD-12'] });
    expect(await codigoDe(crearMaquina.execute(base))).toBe('CODIGO_DUPLICADO');
    expect(await codigoDe(crearMaquina.execute({ ...base, nombre: 'CF-07', patente: 'ab-cd-12' }))).toBe('PATENTE_DUPLICADA');
  });

  it('usa la escritura existente de un tipo y no registra modelo', async () => {
    const { maquinaRepo, modeloRepo, crearMaquina } = crear();
    await crearMaquina.execute({ ...base, tipoMaquina: 'cargador frontal' });
    expect(maquinaRepo.create).toHaveBeenCalledWith(expect.objectContaining({ tipoMaquina: 'Cargador Frontal' }), expect.anything(), []);
    expect(modeloRepo.crearSiNoExiste).not.toHaveBeenCalled();
  });

  it('un tipo nuevo queda registrado como modelo', async () => {
    const { modeloRepo, crearMaquina } = crear();
    await crearMaquina.execute({ ...base, tipoMaquina: 'Pala' });
    expect(modeloRepo.crearSiNoExiste).toHaveBeenCalledWith({
      nombre: 'Pala Komatsu WA600-8',
      marca: 'Komatsu',
      modelo: 'WA600-8',
      tipoMaquina: 'Pala',
    });
  });

  it('si falla el registro del modelo la máquina igual se crea', async () => {
    const { modeloRepo, crearMaquina } = crear();
    modeloRepo.crearSiNoExiste.mockRejectedValueOnce(new Error('db caída'));
    await expect(crearMaquina.execute({ ...base, tipoMaquina: 'Pala' })).resolves.toMatchObject({ nombre: 'CF-06' });
  });

  it('usa la escritura existente de la marca', async () => {
    const { maquinaRepo, modeloRepo, crearMaquina } = crear();
    await crearMaquina.execute({ ...base, marca: 'KOMATSU' });
    expect(maquinaRepo.create).toHaveBeenCalledWith(expect.objectContaining({ marca: 'Komatsu' }), expect.anything(), []);
    expect(modeloRepo.crearSiNoExiste).not.toHaveBeenCalled();
  });

  it('una marca nueva queda registrada como modelo', async () => {
    const { modeloRepo, crearMaquina } = crear();
    await crearMaquina.execute({ ...base, marca: 'Liebherr', modelo: 'L580' });
    expect(modeloRepo.crearSiNoExiste).toHaveBeenCalledWith({
      nombre: 'Cargador Frontal Liebherr L580',
      marca: 'Liebherr',
      modelo: 'L580',
      tipoMaquina: 'Cargador Frontal',
    });
  });

  it('asigna el operador y registra que dejó su máquina anterior', async () => {
    const { maquinaRepo, crearMaquina } = crear();
    maquinaRepo.findOperadorAsignable.mockResolvedValueOnce({
      idOperador: 4,
      nombre: 'Juan Pérez',
      rut: '1-9',
      maquinaAsignada: { idMaquina: 2, nombre: 'CF-02' },
    } as never);
    await crearMaquina.execute({ ...base, idOperador: 4 });
    expect(maquinaRepo.create).toHaveBeenCalledWith(expect.objectContaining({ idOperador: 4 }), expect.anything(), [
      expect.objectContaining({
        idMaquina: 2,
        accion: 'EDITAR',
        observacion: 'Juan Pérez pasó a CF-06',
        detalle: { antes: { operador: 'Juan Pérez' }, despues: { operador: null } },
      }),
    ]);
  });

  it('rechaza un operador que no existe', async () => {
    const { crearMaquina } = crear();
    expect(await codigoDe(crearMaquina.execute({ ...base, idOperador: 99 }))).toBe('DATOS_INVALIDOS');
  });
});
