import type { MaquinaFlota, MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../../domain/repositories/modelo-maquina.repository.port';
import { EditarMaquinaUseCase } from './editar-maquina.use-case';

const maquina: MaquinaFlota = {
  idMaquina: 3,
  nombre: 'CF-03',
  marca: 'Komatsu',
  modelo: 'WA600-8',
  tipoMaquina: 'Cargador Frontal',
  estado: 'ACTIVA',
  patente: 'AB-CD-12',
  anio: 2020,
  numeroChasis: null,
  esContratista: false,
  operadorAsignado: null,
  fueraDeServicio: null,
  operadorActual: null,
  ubicacionActual: null,
  horometroActual: 1500,
};

const crear = (opciones: { nombres?: string[]; patentes?: string[]; enUso?: boolean; tipos?: string[] } = {}) => {
  const maquinaRepo = {
    findById: jest.fn(),
    findActivas: jest.fn(),
    findFlota: jest.fn(),
    findFlotaById: jest.fn(async (id: number) => (id === maquina.idMaquina ? maquina : null)),
    existeNombre: jest.fn(async (nombre: string) => (opciones.nombres ?? []).includes(nombre)),
    existePatente: jest.fn(async (patente: string) => (opciones.patentes ?? []).includes(patente)),
    tieneTurnoEnCurso: jest.fn(async () => opciones.enUso ?? false),
    create: jest.fn(),
    actualizar: jest.fn(async () => undefined),
    findTipos: jest.fn(async () => opciones.tipos ?? ['Cargador Frontal']),
    findOperadoresAsignables: jest.fn(async () => []),
    findOperadorAsignable: jest.fn(async () => null),
    findMarcas: jest.fn(async () => ['Komatsu']),
  } satisfies MaquinaRepositoryPort;
  const modeloRepo = {
    findActivos: jest.fn(),
    crearSiNoExiste: jest.fn(async () => undefined),
  } satisfies ModeloMaquinaRepositoryPort;
  return { maquinaRepo, modeloRepo, editar: new EditarMaquinaUseCase(maquinaRepo, modeloRepo) };
};

const base = { rol: 'JEFE_TURNO', idUsuario: 7, idMaquina: '3', motivo: 'Corrección de datos' };
const registro = { idUsuario: 7, motivo: 'Corrección de datos', observacion: null };

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('EditarMaquinaUseCase', () => {
  it('guarda solo los campos que cambian y deja el antes/después en la bitácora', async () => {
    const { maquinaRepo, editar } = crear();
    await editar.execute({ ...base, nombre: ' cf-03 ', patente: 'zz-yy-99', numeroChasis: ' VIN123 ', anio: 2020 });
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, { patente: 'ZZ-YY-99', numeroChasis: 'VIN123' }, [
      {
        ...registro,
        accion: 'EDITAR',
        detalle: { antes: { patente: 'AB-CD-12', numeroChasis: null }, despues: { patente: 'ZZ-YY-99', numeroChasis: 'VIN123' } },
      },
    ]);
    // El código no cambió (solo mayúsculas y espacios): no se revisa duplicado
    expect(maquinaRepo.existeNombre).not.toHaveBeenCalled();
    expect(maquinaRepo.existePatente).toHaveBeenCalledWith('ZZ-YY-99', 3);
  });

  it('un cambio de estado se registra como habilitar o deshabilitar', async () => {
    const { maquinaRepo, editar } = crear();
    await editar.execute({ ...base, estado: 'BAJA' });
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, { estado: 'BAJA' }, [{ ...registro, accion: 'DESHABILITAR', detalle: null }]);
  });

  it('editar y cambiar el estado a la vez deja ambos registros', async () => {
    const { maquinaRepo, editar } = crear();
    await editar.execute({ ...base, esContratista: true, estado: 'BAJA' });
    const [, cambios, acciones] = maquinaRepo.actualizar.mock.calls[0] as unknown as [number, object, { accion: string }[]];
    expect(cambios).toEqual({ esContratista: true, estado: 'BAJA' });
    expect(acciones.map((a) => a.accion)).toEqual(['EDITAR', 'DESHABILITAR']);
  });

  it('valida permisos, existencia, motivo y que haya cambios', async () => {
    const { maquinaRepo, editar } = crear();
    expect(await codigoDe(editar.execute({ ...base, rol: 'OPERADOR' }))).toBe('SIN_PERMISO');
    expect(await codigoDe(editar.execute({ ...base, idMaquina: '99', nombre: 'X' }))).toBe('MAQUINA_NO_ENCONTRADA');
    expect(await codigoDe(editar.execute({ ...base, idMaquina: 'abc' }))).toBe('MAQUINA_NO_ENCONTRADA');
    expect(await codigoDe(editar.execute({ ...base, motivo: ' ', patente: 'X' }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(editar.execute({ ...base, nombre: '' }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(editar.execute({ ...base, estado: 'ROTA' }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(editar.execute({ ...base, anio: 1800 }))).toBe('ANIO_INVALIDO');
    expect(await codigoDe(editar.execute({ ...base, nombre: 'CF-03', marca: 'komatsu' }))).toBe('SIN_CAMBIOS');
    expect(maquinaRepo.actualizar).not.toHaveBeenCalled();
  });

  it('no permite repetir código ni patente de otra máquina', async () => {
    const { editar } = crear({ nombres: ['CF-04'], patentes: ['XX-11-22'] });
    expect(await codigoDe(editar.execute({ ...base, nombre: 'cf-04' }))).toBe('CODIGO_DUPLICADO');
    expect(await codigoDe(editar.execute({ ...base, patente: 'xx-11-22' }))).toBe('PATENTE_DUPLICADA');
  });

  it('no deja fuera de servicio una máquina con turno en curso', async () => {
    const { maquinaRepo, editar } = crear({ enUso: true });
    expect(await codigoDe(editar.execute({ ...base, estado: 'BAJA' }))).toBe('MAQUINA_EN_USO');
    // Editar otros datos sí se puede
    await editar.execute({ ...base, anio: 2021 });
    expect(maquinaRepo.actualizar).toHaveBeenCalledTimes(1);
  });

  it('un tipo nuevo queda registrado como modelo', async () => {
    const { modeloRepo, editar } = crear();
    await editar.execute({ ...base, tipoMaquina: 'Pala Hidráulica' });
    expect(modeloRepo.crearSiNoExiste).toHaveBeenCalledWith({
      nombre: 'Pala Hidráulica Komatsu WA600-8',
      marca: 'Komatsu',
      modelo: 'WA600-8',
      tipoMaquina: 'Pala Hidráulica',
    });
  });

  it('cambia el operador asignado y lo deja por nombre en la bitácora', async () => {
    const { maquinaRepo, editar } = crear();
    maquinaRepo.findFlotaById.mockResolvedValueOnce({ ...maquina, operadorAsignado: { idOperador: 1, nombre: 'Ana Soto' } });
    maquinaRepo.findOperadorAsignable.mockResolvedValueOnce({
      idOperador: 4,
      nombre: 'Juan Pérez',
      rut: '1-9',
      maquinaAsignada: { idMaquina: 2, nombre: 'CF-02' },
    } as never);
    await editar.execute({ ...base, idOperador: 4 });
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, { idOperador: 4 }, [
      { ...registro, accion: 'EDITAR', detalle: { antes: { operador: 'Ana Soto' }, despues: { operador: 'Juan Pérez' } } },
      expect.objectContaining({ idMaquina: 2, observacion: 'Juan Pérez pasó a CF-03' }),
    ]);
  });

  it('quitar el operador o enviar el mismo', async () => {
    const { maquinaRepo, editar } = crear();
    maquinaRepo.findFlotaById.mockResolvedValue({ ...maquina, operadorAsignado: { idOperador: 1, nombre: 'Ana Soto' } });
    expect(await codigoDe(editar.execute({ ...base, idOperador: 1 }))).toBe('SIN_CAMBIOS');
    expect(maquinaRepo.findOperadorAsignable).not.toHaveBeenCalled();
    await editar.execute({ ...base, idOperador: null });
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, { idOperador: null }, [
      { ...registro, accion: 'EDITAR', detalle: { antes: { operador: 'Ana Soto' }, despues: { operador: null } } },
    ]);
  });
});
