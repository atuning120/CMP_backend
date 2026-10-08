import type { MaquinaRepositoryPort, NuevaMaquina } from '../../domain/repositories/maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../../domain/repositories/modelo-maquina.repository.port';
import { CrearMaquinaUseCase } from './crear-maquina.use-case';

const crear = (existentes: { nombres?: string[]; patentes?: string[]; tipos?: string[]; marcas?: string[] } = {}) => {
  const maquinaRepo = {
    findById: jest.fn(),
    findActivas: jest.fn(),
    findFlota: jest.fn(),
    findFlotaById: jest.fn(),
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
      fueraDeServicio: null,
      operadorActual: null,
      ubicacionActual: null,
      horometroActual: datos.horometroInicial,
    })),
    findTipos: jest.fn(async () => existentes.tipos ?? ['Cargador Frontal']),
    findOperadoresAsignables: jest.fn(async () => []),
    findOperadorAsignable: jest.fn(async () => null),
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
    }, { idUsuario: 7, motivo: 'Aumento de capacidad', observacion: null }, []);
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
