import type { MaquinaRepositoryPort, NuevaMaquina } from '../../domain/repositories/maquina.repository.port';
import { CrearMaquinaUseCase } from './crear-maquina.use-case';

const crear = (existentes: { nombres?: string[]; patentes?: string[] } = {}) => {
  const maquinaRepo = {
    findById: jest.fn(),
    findActivas: jest.fn(),
    findFlota: jest.fn(),
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
      operadorActual: null,
      ubicacionActual: null,
      horometroActual: datos.horometroInicial,
    })),
  } satisfies MaquinaRepositoryPort;
  return { maquinaRepo, crearMaquina: new CrearMaquinaUseCase(maquinaRepo) };
};

const base = { rol: 'JEFE_TURNO', nombre: ' cf-06 ', marca: 'Komatsu', modelo: 'WA600-8', tipoMaquina: 'Cargador Frontal', horometroInicial: 12.5 };

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
    });
  });

  it('solo un jefe de turno o administrador puede crear', async () => {
    const { crearMaquina } = crear();
    expect(await codigoDe(crearMaquina.execute({ ...base, rol: 'OPERADOR' }))).toBe('SIN_PERMISO');
    await expect(crearMaquina.execute({ ...base, rol: 'ADMIN' })).resolves.toBeDefined();
  });

  it('rechaza datos obligatorios faltantes o inválidos', async () => {
    const { maquinaRepo, crearMaquina } = crear();
    expect(await codigoDe(crearMaquina.execute({ ...base, nombre: '   ' }))).toBe('DATOS_INVALIDOS');
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
});
