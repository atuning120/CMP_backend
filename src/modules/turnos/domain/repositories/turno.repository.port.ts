import { Turno } from '../entities/turno.entity';
import { UbicacionTurno } from '../entities/ubicacion-turno';

export const TURNO_REPOSITORY = Symbol('TURNO_REPOSITORY');

export interface TurnoRepositoryPort {
  // Al guardar un turno con fecha de término, también cierra su ubicación vigente.
  save(turno: Turno): Promise<Turno>;
  // Crea el turno junto a su ubicación inicial en una sola transacción.
  iniciar(turno: Turno, ubicacion: UbicacionTurno): Promise<Turno>;
  findById(id: number): Promise<Turno | null>;
  findActivoByMaquina(idMaquina: number): Promise<Turno | null>;
  findActivoByOperador(idOperador: number): Promise<Turno | null>;
  findUltimoByOperador(idOperador: number): Promise<Turno | null>;
  findActivosIniciadosAntesDe(fecha: Date): Promise<Turno[]>;
  findUbicacionVigente(idTurno: number): Promise<UbicacionTurno | null>;
}
