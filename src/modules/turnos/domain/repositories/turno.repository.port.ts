import { Turno } from '../entities/turno.entity';
import { UbicacionTurno, UbicacionTurnoRegistro } from '../entities/ubicacion-turno';

export const TURNO_REPOSITORY = Symbol('TURNO_REPOSITORY');

export interface TurnoRepositoryPort {
  // Al guardar un turno con fecha de término, también cierra su ubicación vigente.
  save(turno: Turno): Promise<Turno>;
  // Crea el turno junto a su ubicación inicial en una sola transacción.
  iniciar(turno: Turno, ubicacion: UbicacionTurno): Promise<Turno>;
  findById(id: number): Promise<Turno | null>;
  findByIdCliente(idCliente: string): Promise<Turno | null>;
  findActivoByMaquina(idMaquina: number): Promise<Turno | null>;
  findActivoByOperador(idOperador: number): Promise<Turno | null>;
  findUltimoByOperador(idOperador: number): Promise<Turno | null>;
  findActivosIniciadosAntesDe(fecha: Date): Promise<Turno[]>;
  findUbicacionVigente(idTurno: number): Promise<UbicacionTurno | null>;
  findUbicacionByIdCliente(idCliente: string): Promise<UbicacionTurnoRegistro | null>;
  // Cierra la ubicación vigente del turno (fin = inicio de la nueva) e inserta la nueva, en una transacción
  registrarUbicacion(data: {
    idTurno: number;
    idArea: number;
    idZona: number | null;
    inicio: Date;
    fin: Date | null;
    idCliente: string;
  }): Promise<UbicacionTurnoRegistro>;
  // Horómetro final del turno más reciente de la máquina iniciado antes de `antesDe` (null si no hay)
  findUltimoHorometroFinal(idMaquina: number, antesDe: Date): Promise<number | null>;
}
