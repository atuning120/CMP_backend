import type { AtencionAlerta } from './alerta-turno.repository.port';

export const ATENCION_ALERTA_REPOSITORY = Symbol('ATENCION_ALERTA_REPOSITORY');

// Atenciones de las alertas de turno (tabla ATENCION_ALERTA): solo se agregan, nunca se editan ni se borran
export interface AtencionAlertaRepositoryPort {
  registrar(datos: { idAlerta: string; idTurno: number; idUsuario: number; comentario: string | null }): Promise<void>;
  // De la primera a la última
  listar(idAlerta: string): Promise<AtencionAlerta[]>;
}
