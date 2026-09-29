import { Turno } from '../entities/turno.entity';

export const TURNO_REPOSITORY = Symbol('TURNO_REPOSITORY');

export interface TurnoRepositoryPort {
  save(turno: Turno): Promise<Turno>;
  findById(id: number): Promise<Turno | null>;
  findActivoByMaquina(idMaquina: number): Promise<Turno | null>;
  findActivoByOperador(idOperador: number): Promise<Turno | null>;
}
