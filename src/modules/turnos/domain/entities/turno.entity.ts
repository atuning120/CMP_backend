export class Turno {
  constructor(
    public readonly id: string,
    public readonly idOperador: string,
    public readonly idMaquina: string,
    public readonly fechaInicio: Date,
    public fechaFin: Date | null,
    public horometroInicial: number,
    public horometroFinal: number | null,
    public estadoActual: string,
  ) {}

  finalizar(fecha: Date, horometro: number) {
    if (this.fechaFin) {
      throw new Error('El turno ya está finalizado');
    }
    if (horometro < this.horometroInicial) {
      throw new Error('El horómetro final no puede ser menor al inicial');
    }
    this.fechaFin = fecha;
    this.horometroFinal = horometro;
  }
}
