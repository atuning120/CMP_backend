import { Inject, Injectable } from '@nestjs/common';
import {
  GEOCERCA_ESCRITURA_REPOSITORY,
  GEOCERCA_REPOSITORY,
} from '../../domain/repositories/geocerca.repository.port';
import type {
  DatosGeocerca,
  EdicionGeocerca,
  GeocercaEscrituraPort,
  GeocercaRepositoryPort,
  PoligonoGeoJson,
} from '../../domain/repositories/geocerca.repository.port';
import { geocercaError } from '../geocerca.errors';

const ROLES_EDICION = ['ADMIN'];
const LARGO_MAXIMO_NOMBRE = 100;
const MAXIMO_VERTICES = 500;

export interface Autor {
  rol: string;
  idUsuario: number;
}

// Cuerpo de crear/editar tal como llega del cliente; se valida aquí
export interface GeocercaDto {
  nombre?: unknown;
  descripcion?: unknown;
  poligono?: unknown;
}

const esCoordenada = (p: unknown): p is [number, number] =>
  Array.isArray(p) &&
  p.length >= 2 &&
  Number.isFinite(p[0]) &&
  Number.isFinite(p[1]) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;

// Polygon GeoJSON de un solo anillo, cerrado, en lon/lat. Se descarta la altura si viene
export const leerPoligono = (valor: unknown): PoligonoGeoJson | null => {
  if (!valor || typeof valor !== 'object') return null;
  const { type, coordinates } = valor as { type?: unknown; coordinates?: unknown };
  if (type !== 'Polygon' || !Array.isArray(coordinates) || coordinates.length !== 1) return null;
  const anillo: unknown = coordinates[0];
  if (!Array.isArray(anillo) || anillo.length < 4 || anillo.length > MAXIMO_VERTICES + 1) return null;
  if (!anillo.every(esCoordenada)) return null;
  const [primero, ultimo] = [anillo[0], anillo[anillo.length - 1]];
  if (primero[0] !== ultimo[0] || primero[1] !== ultimo[1]) return null;
  return { type: 'Polygon', coordinates: [anillo.map(([lon, lat]) => [lon, lat])] };
};

const leerTexto = (valor: unknown): string | null => (typeof valor === 'string' && valor.trim() ? valor.trim() : null);

/**
 * Crea, edita y desactiva áreas y zonas de trabajo (solo ADMIN). Reglas:
 * - el polígono debe ser válido (sin auto-intersecciones);
 * - una zona debe quedar dentro del polígono de su área;
 * - un área no puede achicarse dejando zonas activas fuera.
 */
@Injectable()
export class GestionarGeocercasUseCase {
  constructor(
    @Inject(GEOCERCA_REPOSITORY)
    private readonly lecturaRepo: GeocercaRepositoryPort,
    @Inject(GEOCERCA_ESCRITURA_REPOSITORY)
    private readonly escrituraRepo: GeocercaEscrituraPort,
  ) {}

  async crearArea(dto: GeocercaDto, autor: Autor): Promise<{ idArea: number }> {
    this.exigirPermiso(autor);
    const datos = await this.leerDatosNuevos(dto);
    return { idArea: await this.escrituraRepo.crearArea(datos, autor.idUsuario) };
  }

  async editarArea(idArea: number, dto: GeocercaDto, autor: Autor): Promise<void> {
    this.exigirPermiso(autor);
    const actual = await this.lecturaRepo.findAreaById(idArea);
    if (!actual || actual.estado !== 'ACTIVA') throw geocercaError('AREA_NO_ENCONTRADA');
    const edicion = await this.leerEdicion(dto, actual);
    if (edicion.poligono) {
      const fuera = await this.escrituraRepo.contarZonasFueraDe(idArea, edicion.poligono);
      if (fuera > 0) {
        throw geocercaError(
          'ZONAS_FUERA_DEL_AREA',
          `${fuera} zona${fuera === 1 ? '' : 's'} de trabajo quedaría${fuera === 1 ? '' : 'n'} fuera del área. Ajusta o desactiva esas zonas primero.`,
        );
      }
    }
    await this.escrituraRepo.editarArea(idArea, edicion, autor.idUsuario);
  }

  async desactivarArea(idArea: number, autor: Autor): Promise<void> {
    this.exigirPermiso(autor);
    const actual = await this.lecturaRepo.findAreaById(idArea);
    if (!actual || actual.estado !== 'ACTIVA') throw geocercaError('AREA_NO_ENCONTRADA');
    await this.escrituraRepo.desactivarArea(idArea, autor.idUsuario);
  }

  async crearZona(idArea: number, dto: GeocercaDto, autor: Autor): Promise<{ idZona: number }> {
    this.exigirPermiso(autor);
    const area = await this.lecturaRepo.findAreaById(idArea);
    if (!area || area.estado !== 'ACTIVA') throw geocercaError('AREA_NO_ENCONTRADA');
    const datos = await this.leerDatosNuevos(dto);
    if (!(await this.escrituraRepo.zonaDentroDeArea(datos.poligono, idArea))) throw geocercaError('ZONA_FUERA_DEL_AREA');
    return { idZona: await this.escrituraRepo.crearZona(idArea, datos, autor.idUsuario) };
  }

  async editarZona(idZona: number, dto: GeocercaDto, autor: Autor): Promise<void> {
    this.exigirPermiso(autor);
    const actual = await this.lecturaRepo.findZonaById(idZona);
    if (!actual || actual.estado !== 'ACTIVA') throw geocercaError('ZONA_NO_ENCONTRADA');
    const edicion = await this.leerEdicion(dto, actual);
    if (edicion.poligono && !(await this.escrituraRepo.zonaDentroDeArea(edicion.poligono, actual.idArea))) {
      throw geocercaError('ZONA_FUERA_DEL_AREA');
    }
    await this.escrituraRepo.editarZona(idZona, edicion, autor.idUsuario);
  }

  async desactivarZona(idZona: number, autor: Autor): Promise<void> {
    this.exigirPermiso(autor);
    const actual = await this.lecturaRepo.findZonaById(idZona);
    if (!actual || actual.estado !== 'ACTIVA') throw geocercaError('ZONA_NO_ENCONTRADA');
    await this.escrituraRepo.desactivarZona(idZona, autor.idUsuario);
  }

  private exigirPermiso(autor: Autor) {
    if (!ROLES_EDICION.includes(autor?.rol) || !autor.idUsuario) throw geocercaError('SIN_PERMISO');
  }

  private async leerDatosNuevos(dto: GeocercaDto): Promise<DatosGeocerca> {
    const nombre = leerTexto(dto?.nombre);
    if (!nombre) throw geocercaError('DATOS_INVALIDOS', 'Debe ingresar un nombre');
    if (nombre.length > LARGO_MAXIMO_NOMBRE) throw geocercaError('DATOS_INVALIDOS', `El nombre admite hasta ${LARGO_MAXIMO_NOMBRE} caracteres`);
    const poligono = await this.leerPoligonoValido(dto.poligono);
    return { nombre, descripcion: leerTexto(dto.descripcion), poligono };
  }

  // Solo cambia lo que viene en el cuerpo; el resto conserva el valor actual
  private async leerEdicion(dto: GeocercaDto, actual: { nombre: string; descripcion: string | null }): Promise<EdicionGeocerca> {
    let nombre = actual.nombre;
    if (dto?.nombre !== undefined) {
      const nuevo = leerTexto(dto.nombre);
      if (!nuevo) throw geocercaError('DATOS_INVALIDOS', 'Debe ingresar un nombre');
      if (nuevo.length > LARGO_MAXIMO_NOMBRE) throw geocercaError('DATOS_INVALIDOS', `El nombre admite hasta ${LARGO_MAXIMO_NOMBRE} caracteres`);
      nombre = nuevo;
    }
    const descripcion = dto?.descripcion !== undefined ? leerTexto(dto.descripcion) : actual.descripcion;
    const poligono = dto?.poligono !== undefined ? await this.leerPoligonoValido(dto.poligono) : null;
    return { nombre, descripcion, poligono };
  }

  private async leerPoligonoValido(valor: unknown): Promise<PoligonoGeoJson> {
    const poligono = leerPoligono(valor);
    if (!poligono) {
      throw geocercaError('POLIGONO_INVALIDO', `Se espera un Polygon GeoJSON cerrado, de 3 a ${MAXIMO_VERTICES} vértices y sin agujeros`);
    }
    if (!(await this.escrituraRepo.esPoligonoValido(poligono))) {
      throw geocercaError('POLIGONO_INVALIDO', 'El polígono se cruza consigo mismo');
    }
    return poligono;
  }
}
