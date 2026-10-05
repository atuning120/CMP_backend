export type EstadoTurno = 'EN_CURSO' | 'CERRADO' | 'CERRADO_AUTO';

// Un turno abierto por más de este tiempo se considera olvidado y se cierra automáticamente.
export const DURACION_MAXIMA_TURNO_HORAS = 12;
const DURACION_MAXIMA_TURNO_MS = DURACION_MAXIMA_TURNO_HORAS * 60 * 60 * 1000;

export class Turno {
  constructor(
    public id: number | null,
    public readonly idOperador: number,
    public readonly idMaquina: number,
    public readonly fechaInicio: Date,
    public fechaFin: Date | null,
    public horometroInicial: number,
    public horometroFinal: number | null,
    public estadoActual: EstadoTurno,
  ) {}

  get enCurso(): boolean {
    return this.estadoActual === 'EN_CURSO' && !this.fechaFin;
  }

  excedeDuracionMaxima(ahora: Date): boolean {
    return this.enCurso && ahora.getTime() - this.fechaInicio.getTime() > DURACION_MAXIMA_TURNO_MS;
  }

  finalizar(fecha: Date, horometro: number) {
    if (!this.enCurso) {
      throw new Error('El turno ya está finalizado');
    }
    if (horometro < this.horometroInicial) {
      throw new Error('El horómetro final no puede ser menor al inicial');
    }
    this.fechaFin = fecha;
    this.horometroFinal = horometro;
    this.estadoActual = 'CERRADO';
  }

  // Cierre por sistema: el término se fija en el límite de 12 h (no en el momento de la detección)
  // para no inflar las horas del turno. El horómetro final queda pendiente de regularizar.
  cerrarAutomaticamente() {
    if (!this.enCurso) {
      throw new Error('El turno ya está finalizado');
    }
    this.fechaFin = new Date(this.fechaInicio.getTime() + DURACION_MAXIMA_TURNO_MS);
    this.estadoActual = 'CERRADO_AUTO';
  }
}
