import { Turno } from '../entities/turno.entity';

export const TURNO_REPOSITORY = Symbol('TURNO_REPOSITORY');

export interface TurnoRepositoryPort {
  save(turno: Turno): Promise<void>;
  findById(id: string): Promise<Turno | null>;
  findActivoByMaquina(idMaquina: string): Promise<Turno | null>;
  findActivoByOperador(idOperador: string): Promise<Turno | null>;
}
