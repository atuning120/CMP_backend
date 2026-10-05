export const GEOCERCA_REPOSITORY = Symbol('GEOCERCA_REPOSITORY');

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
  findZonaById(idZona: number): Promise<ZonaTrabajoResumen | null>;
}
