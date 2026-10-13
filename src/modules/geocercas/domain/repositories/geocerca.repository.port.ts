export const GEOCERCA_REPOSITORY = Symbol('GEOCERCA_REPOSITORY');
export const GEOCERCA_ESCRITURA_REPOSITORY = Symbol('GEOCERCA_ESCRITURA_REPOSITORY');

export interface AreaResumen {
  idArea: number;
  nombre: string;
  descripcion: string | null;
  estado: string | null;
}

export interface ZonaTrabajoResumen {
  idZona: number;
  idArea: number;
  nombre: string;
  descripcion: string | null;
  estado: string | null;
}

export interface GeocercaRepositoryPort {
  findAreasActivas(): Promise<AreaResumen[]>;
  findAreaById(idArea: number): Promise<AreaResumen | null>;
  findZonasActivasByArea(idArea: number): Promise<ZonaTrabajoResumen[]>;
  findZonasActivas(): Promise<ZonaTrabajoResumen[]>;
  findZonaById(idZona: number): Promise<ZonaTrabajoResumen | null>;
}

// Polígono simple (sin agujeros) en WGS84, en el formato GeoJSON que dibuja el mapa web
export interface PoligonoGeoJson {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface AreaMapa extends AreaResumen {
  poligono: PoligonoGeoJson | null;
}

export interface ZonaMapa extends ZonaTrabajoResumen {
  poligono: PoligonoGeoJson | null;
}

export interface DatosGeocerca {
  nombre: string;
  descripcion: string | null;
  poligono: PoligonoGeoJson;
}

// Valores finales de una edición; poligono null = no cambia
export interface EdicionGeocerca {
  nombre: string;
  descripcion: string | null;
  poligono: PoligonoGeoJson | null;
}

// Escritura de geocercas: cada cambio queda en AUDITORIA_GEOCERCA (con el polígono anterior)
// dentro de la misma transacción
export interface GeocercaEscrituraPort {
  findMapa(): Promise<{ areas: AreaMapa[]; zonas: ZonaMapa[] }>;
  // ST_IsValid: descarta polígonos que se cruzan a sí mismos
  esPoligonoValido(poligono: PoligonoGeoJson): Promise<boolean>;
  // La zona queda contenida en el polígono del área (true si el área aún no tiene polígono)
  zonaDentroDeArea(poligono: PoligonoGeoJson, idArea: number): Promise<boolean>;
  // Zonas activas del área que quedarían fuera si el área pasa a tener este polígono
  contarZonasFueraDe(idArea: number, poligono: PoligonoGeoJson): Promise<number>;
  crearArea(datos: DatosGeocerca, idUsuario: number): Promise<number>;
  editarArea(idArea: number, edicion: EdicionGeocerca, idUsuario: number): Promise<void>;
  // Desactiva el área y sus zonas activas
  desactivarArea(idArea: number, idUsuario: number): Promise<void>;
  crearZona(idArea: number, datos: DatosGeocerca, idUsuario: number): Promise<number>;
  editarZona(idZona: number, edicion: EdicionGeocerca, idUsuario: number): Promise<void>;
  desactivarZona(idZona: number, idUsuario: number): Promise<void>;
}
