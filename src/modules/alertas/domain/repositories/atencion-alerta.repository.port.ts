import type { AtencionAlerta } from './alerta-turno.repository.port';

export const ATENCION_ALERTA_REPOSITORY = Symbol('ATENCION_ALERTA_REPOSITORY');

// Atenciones de las alertas de turno (tabla ATENCION_ALERTA): solo se agregan, nunca se editan ni se borran
export interface AtencionAlertaRepositoryPort {
  // idCliente (UUID del cliente) hace idempotente el reintento: si ya se registró, no se agrega otra vez
  // fecha null = ahora
  registrar(datos: {
    idAlerta: string;
    idTurno: number;
    idUsuario: number;
    comentario: string | null;
    idCliente: string | null;
    fecha: Date | null;
  }): Promise<void>;
  existeIdCliente(idCliente: string): Promise<boolean>;
  // De la primera a la última
  listar(idAlerta: string): Promise<AtencionAlerta[]>;
}
