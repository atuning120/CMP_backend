export const TURNO_ESTADO_REPOSITORY = Symbol('TURNO_ESTADO_REPOSITORY');

export type CategoriaEstado = 'PRODUCTIVO' | 'DEMORA' | 'MANTENCION';

export interface EstadoOperacionalResumen {
  idEstado: number;
  nombre: string;
  categoria: CategoriaEstado | null;
  esProductivo: boolean;
  activo: boolean;
}

export interface TurnoEstadoRegistro {
  idTurnoEstado: number;
  idTurno: number;
  idEstado: number;
  inicio: Date;
  fin: Date | null;
  comentario: string | null;
  idCliente: string | null;
}

export interface TurnoEstadoRepositoryPort {
  findCatalogoActivo(): Promise<EstadoOperacionalResumen[]>;
  findEstadoById(idEstado: number): Promise<EstadoOperacionalResumen | null>;
  findByIdCliente(idCliente: string): Promise<TurnoEstadoRegistro | null>;
  findHistorial(idTurno: number): Promise<TurnoEstadoRegistro[]>;
  // Cierra el estado vigente del turno (fin = inicio del nuevo) e inserta el nuevo, en una transacción
  registrarCambio(data: {
    idTurno: number;
    idEstado: number;
    inicio: Date;
    fin: Date | null;
    comentario: string | null;
    idCliente: string;
  }): Promise<TurnoEstadoRegistro>;
}
