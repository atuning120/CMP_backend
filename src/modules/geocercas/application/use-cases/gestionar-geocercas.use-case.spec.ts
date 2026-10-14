import type {
  GeocercaEscrituraPort,
  GeocercaRepositoryPort,
  PoligonoGeoJson,
} from '../../domain/repositories/geocerca.repository.port';
import { GestionarGeocercasUseCase, leerPoligono } from './gestionar-geocercas.use-case';

const ADMIN = { rol: 'ADMIN', idUsuario: 1 };
const CUADRADO: PoligonoGeoJson = {
  type: 'Polygon',
  coordinates: [[[-70.81, -28.30], [-70.80, -28.30], [-70.80, -28.29], [-70.81, -28.29], [-70.81, -28.30]]],
};
const AREA = { idArea: 5, nombre: 'Área 51', descripcion: null, estado: 'ACTIVA' };
const ZONA = { idZona: 9, idArea: 5, nombre: 'Tolva', descripcion: 'Descarga', estado: 'ACTIVA' };

const crear = (opciones: { valido?: boolean; dentro?: boolean; fuera?: number; area?: typeof AREA | null } = {}) => {
  const lectura = {
    findAreasActivas: jest.fn(),
    findAreaById: jest.fn(async () => (opciones.area === undefined ? AREA : opciones.area)),
    findZonasActivasByArea: jest.fn(),
    findZonasActivas: jest.fn(),
    findZonaById: jest.fn(async () => ZONA),
  } satisfies GeocercaRepositoryPort;
  const escritura = {
    findMapa: jest.fn(),
    esPoligonoValido: jest.fn(async () => opciones.valido ?? true),
    zonaDentroDeArea: jest.fn(async () => opciones.dentro ?? true),
    contarZonasFueraDe: jest.fn(async () => opciones.fuera ?? 0),
    crearArea: jest.fn(async () => 7),
    editarArea: jest.fn(async () => undefined),
    desactivarArea: jest.fn(async () => undefined),
    crearZona: jest.fn(async () => 11),
    editarZona: jest.fn(async () => undefined),
    desactivarZona: jest.fn(async () => undefined),
  } satisfies GeocercaEscrituraPort;
  return { escritura, useCase: new GestionarGeocercasUseCase(lectura, escritura) };
};

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('leerPoligono', () => {
  it('acepta un Polygon cerrado y descarta la altura', () => {
    const conAltura = { type: 'Polygon', coordinates: [CUADRADO.coordinates[0].map(([x, y]) => [x, y, 1200])] };
    expect(leerPoligono(conAltura)).toEqual(CUADRADO);
  });

  it.each([
    ['otro tipo', { type: 'Point', coordinates: [-70.8, -28.3] }],
    ['anillo abierto', { type: 'Polygon', coordinates: [CUADRADO.coordinates[0].slice(0, 4)] }],
    ['menos de 3 vértices', { type: 'Polygon', coordinates: [[[-70.8, -28.3], [-70.7, -28.3], [-70.8, -28.3]]] }],
    ['con agujeros', { type: 'Polygon', coordinates: [CUADRADO.coordinates[0], CUADRADO.coordinates[0]] }],
    ['coordenada fuera de rango', { type: 'Polygon', coordinates: [[[-70.8, -95], [-70.7, -28.3], [-70.7, -28.2], [-70.8, -95]]] }],
    ['texto', 'POLYGON((...))'],
  ])('rechaza %s', (_caso, valor) => {
    expect(leerPoligono(valor)).toBeNull();
  });
});

describe('GestionarGeocercasUseCase', () => {
  it('crea un área con nombre recortado y deja registro del autor', async () => {
    const { escritura, useCase } = crear();

    expect(await useCase.crearArea({ nombre: '  Área 60 ', descripcion: '', poligono: CUADRADO }, ADMIN)).toEqual({ idArea: 7 });
    expect(escritura.crearArea).toHaveBeenCalledWith({ nombre: 'Área 60', descripcion: null, poligono: CUADRADO }, 1);
  });

  it.each(['JEFE_TURNO', 'VISOR', 'OPERADOR'])('un %s no puede modificar geocercas', async (rol) => {
    const { escritura, useCase } = crear();

    expect(await codigoDe(useCase.crearArea({ nombre: 'X', poligono: CUADRADO }, { rol, idUsuario: 2 }))).toBe('SIN_PERMISO');
    expect(await codigoDe(useCase.desactivarZona(9, { rol, idUsuario: 2 }))).toBe('SIN_PERMISO');
    expect(escritura.crearArea).not.toHaveBeenCalled();
    expect(escritura.desactivarZona).not.toHaveBeenCalled();
  });

  it('rechaza un polígono que se cruza consigo mismo', async () => {
    const { escritura, useCase } = crear({ valido: false });

    expect(await codigoDe(useCase.crearArea({ nombre: 'X', poligono: CUADRADO }, ADMIN))).toBe('POLIGONO_INVALIDO');
    expect(escritura.crearArea).not.toHaveBeenCalled();
  });

  it('no crea una zona fuera de su área', async () => {
    const { escritura, useCase } = crear({ dentro: false });

    expect(await codigoDe(useCase.crearZona(5, { nombre: 'Z', poligono: CUADRADO }, ADMIN))).toBe('ZONA_FUERA_DEL_AREA');
    expect(escritura.crearZona).not.toHaveBeenCalled();
  });

  it('no crea zonas en un área inactiva o inexistente', async () => {
    const { useCase } = crear({ area: { ...AREA, estado: 'INACTIVA' } });

    expect(await codigoDe(useCase.crearZona(5, { nombre: 'Z', poligono: CUADRADO }, ADMIN))).toBe('AREA_NO_ENCONTRADA');
  });

  it('no achica un área dejando zonas activas fuera', async () => {
    const { escritura, useCase } = crear({ fuera: 2 });

    expect(await codigoDe(useCase.editarArea(5, { poligono: CUADRADO }, ADMIN))).toBe('ZONAS_FUERA_DEL_AREA');
    expect(escritura.editarArea).not.toHaveBeenCalled();
  });

  it('editar solo el nombre conserva la descripción y no toca el polígono', async () => {
    const { escritura, useCase } = crear();

    await useCase.editarZona(9, { nombre: 'Tolva Norte' }, ADMIN);

    expect(escritura.editarZona).toHaveBeenCalledWith(9, { nombre: 'Tolva Norte', descripcion: 'Descarga', poligono: null }, 1);
    expect(escritura.zonaDentroDeArea).not.toHaveBeenCalled();
  });

  it('exige nombre al crear', async () => {
    const { useCase } = crear();

    expect(await codigoDe(useCase.crearArea({ nombre: '   ', poligono: CUADRADO }, ADMIN))).toBe('DATOS_INVALIDOS');
  });
});
