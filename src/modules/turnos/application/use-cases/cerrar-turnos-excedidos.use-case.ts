import { Injectable, Inject } from '@nestjs/common';
import { TURNO_REPOSITORY } from '../../domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import { DURACION_MAXIMA_TURNO_HORAS, Turno } from '../../domain/entities/turno.entity';

// Cierra como CERRADO_AUTO todos los turnos que siguen abiertos después de DURACION_MAXIMA_TURNO_HORAS (13 h)
// (típicamente porque el operador olvidó cerrarlos).
@Injectable()
export class CerrarTurnosExcedidosUseCase {
  constructor(
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
  ) {}

  async execute(ahora: Date = new Date()): Promise<Turno[]> {
    const limite = new Date(ahora.getTime() - DURACION_MAXIMA_TURNO_HORAS * 60 * 60 * 1000);
    const excedidos = await this.turnoRepo.findActivosIniciadosAntesDe(limite);

    const cerrados: Turno[] = [];
    for (const turno of excedidos) {
      turno.cerrarAutomaticamente();
      // Si el operador o un jefe de turno lo cerró justo ahora, se respeta ese cierre
      const cerrado = await this.turnoRepo.cerrar(turno, false);
      if (cerrado) cerrados.push(cerrado);
    }
    return cerrados;
  }
}
