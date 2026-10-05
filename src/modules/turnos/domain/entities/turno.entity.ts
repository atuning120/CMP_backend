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
    // UUID generado por la app al registrar el turno (incluso offline); null en turnos creados sin la app
    public readonly idCliente: string | null = null,
    public conflicto: boolean = false,
    public conflictoDetalle: string | null = null,
  ) {}

  get enCurso(): boolean {
    return this.estadoActual === 'EN_CURSO' && !this.fechaFin;
  }

  get limiteCierreAutomatico(): Date {
    return new Date(this.fechaInicio.getTime() + DURACION_MAXIMA_TURNO_MS);
  }

  excedeDuracionMaxima(ahora: Date): boolean {
    return this.enCurso && ahora.getTime() > this.limiteCierreAutomatico.getTime();
  }

  /**
   * Cierre informado por el operador. `fecha` es el momento real del cierre (puede venir de un
   * registro offline sincronizado después).
   * - Dentro de las 12 h: queda CERRADO. Si el sistema ya lo había cerrado automáticamente
   *   (porque el cierre llegó tarde por falta de conexión), se corrige con los datos reales.
   * - Después de las 12 h: queda CERRADO_AUTO en el límite, pero se conserva el horómetro final.
   */
  finalizar(fecha: Date, horometro: number) {
    if (this.estadoActual === 'CERRADO') {
      throw new Error('El turno ya está finalizado');
    }
    if (fecha.getTime() < this.fechaInicio.getTime()) {
      throw new Error('La fecha de cierre no puede ser anterior al inicio');
    }
    if (horometro < this.horometroInicial) {
      throw new Error('El horómetro final no puede ser menor al inicial');
    }
    this.horometroFinal = horometro;
    if (fecha.getTime() > this.limiteCierreAutomatico.getTime()) {
      this.fechaFin = this.limiteCierreAutomatico;
      this.estadoActual = 'CERRADO_AUTO';
      return;
    }
    this.fechaFin = fecha;
    this.estadoActual = 'CERRADO';
  }

  // Cierre por sistema: el término se fija en el límite de 12 h (no en el momento de la detección)
  // para no inflar las horas del turno. El horómetro final queda pendiente de regularizar.
  cerrarAutomaticamente() {
    if (!this.enCurso) {
      throw new Error('El turno ya está finalizado');
    }
    this.fechaFin = this.limiteCierreAutomatico;
    this.estadoActual = 'CERRADO_AUTO';
  }

  marcarConflicto(detalle: string) {
    this.conflicto = true;
    this.conflictoDetalle = this.conflictoDetalle ? `${this.conflictoDetalle} | ${detalle}` : detalle;
  }
}
