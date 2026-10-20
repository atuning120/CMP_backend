import type {
  AreaResumen,
  GeocercaRepositoryPort,
  ZonaTrabajoResumen,
} from '../../geocercas/domain/repositories/geocerca.repository.port';
import type { Turno } from '../domain/entities/turno.entity';
import { turnoError } from './turno.errors';

/**
 * Valida el área y la zona elegidas por el operador. Se rechaza lo imposible de guardar (área o zona
 * inexistente, zona de otra área); un área o zona dada de baja no se rechaza: sin conexión el operador
 * pudo no saberlo, así que queda marcada como conflicto en el turno.
 */
export const validarUbicacion = async (
  geocercaRepo: GeocercaRepositoryPort,
  idArea: number,
  idZona: number | null,
): Promise<{ area: AreaResumen; zona: ZonaTrabajoResumen | null }> => {
  const area = Number.isInteger(idArea) ? await geocercaRepo.findAreaById(idArea) : null;
  if (!area) {
    throw turnoError('AREA_NO_DISPONIBLE');
  }
  if (idZona === null) {
    return { area, zona: null };
  }
  const zona = Number.isInteger(idZona) ? await geocercaRepo.findZonaById(idZona) : null;
  if (!zona || zona.idArea !== area.idArea) {
    throw turnoError('ZONA_NO_DISPONIBLE');
  }
  return { area, zona };
};

// Marca el conflicto si el área o la zona no estaban activas al sincronizar. Devuelve si marcó alguno
export const marcarUbicacionInactiva = (
  turno: Turno,
  { area, zona }: { area: AreaResumen; zona: ZonaTrabajoResumen | null },
): boolean => {
  let marcado = false;
  if (area.estado !== 'ACTIVA') {
    turno.marcarConflicto(`El área ${area.nombre} no estaba activa al sincronizar`);
    marcado = true;
  }
  if (zona && zona.estado !== 'ACTIVA') {
    turno.marcarConflicto(`La zona ${zona.nombre} no estaba activa al sincronizar`);
    marcado = true;
  }
  return marcado;
};
