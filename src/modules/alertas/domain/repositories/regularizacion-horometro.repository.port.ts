export const REGULARIZACION_HOROMETRO_REPOSITORY = Symbol('REGULARIZACION_HOROMETRO_REPOSITORY');

export interface TurnoARegularizar {
  idTurno: number;
  operador: string;
  horometroInicial: number;
  horometroFinal: number | null;
  // Horómetro inicial del turno siguiente de la máquina; null si aún no hay otro
  horometroSiguiente: number | null;
}

export interface Regularizacion {
  idTurno: number;
  idAlerta: string;
  idUsuario: number;
  horometroFinal: number;
  // Lo que queda como atención de la alerta
  comentarioAtencion: string;
  // Lo que escribió el jefe de turno; va como observación en la bitácora
  observacion: string | null;
  idCliente: string | null;
  fecha: Date | null; // null = ahora
}

export interface RegularizacionHorometroRepositoryPort {
  // El turno, solo si el sistema lo cerró automáticamente; null en cualquier otro caso
  turnoCerradoAutomaticamente(idTurno: number): Promise<TurnoARegularizar | null>;
  existeIdCliente(idCliente: string): Promise<boolean>;
  // En una sola operación: guarda el horómetro, la acción en la bitácora y la atención de la alerta. Devuelve false si
  // el turno ya tenía horómetro (de dos regularizaciones simultáneas gana la primera)
  regularizar(datos: Regularizacion): Promise<boolean>;
}
