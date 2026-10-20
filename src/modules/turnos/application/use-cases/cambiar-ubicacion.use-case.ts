import { Injectable, Inject } from '@nestjs/common';
import { TURNO_REPOSITORY } from '../../domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import { GEOCERCA_REPOSITORY } from '../../../geocercas/domain/repositories/geocerca.repository.port';
import type { GeocercaRepositoryPort } from '../../../geocercas/domain/repositories/geocerca.repository.port';
import type { UbicacionTurnoRegistro } from '../../domain/entities/ubicacion-turno';
import { CambiarUbicacionDto } from '../dtos/cambiar-ubicacion.dto';
import { turnoError } from '../turno.errors';
import { fechaDelEvento, validarIdCliente } from '../datos-cliente';
import { marcarUbicacionInactiva, validarUbicacion } from '../ubicacion';
import { buscarTurnoDelOperador } from './finalizar-turno.use-case';

/**
 * Registra que el operador pasó a trabajar en otra área o zona sin cambiar de máquina (p. ej. lo
 * reasignaron o volvió de colación a otro frente). La ubicación vigente se cierra en el momento en que
 * empieza la nueva, así las horas del turno se pueden imputar a cada área.
 */
@Injectable()
export class CambiarUbicacionUseCase {
  constructor(
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
    @Inject(GEOCERCA_REPOSITORY)
    private readonly geocercaRepo: GeocercaRepositoryPort,
  ) {}

  async execute(dto: CambiarUbicacionDto, ahora: Date = new Date()): Promise<UbicacionTurnoRegistro> {
    const idCliente = validarIdCliente(dto.idCliente);
    if (!idCliente) throw turnoError('ID_CLIENTE_INVALIDO');

    const turno = await buscarTurnoDelOperador(this.turnoRepo, dto.idOperador, dto);

    const existente = await this.turnoRepo.findUbicacionByIdCliente(idCliente);
    if (existente) {
      if (existente.idTurno !== turno.id) throw turnoError('ID_CLIENTE_INVALIDO');
      return existente;
    }

    const ubicacion = await validarUbicacion(this.geocercaRepo, dto.idArea, dto.idZona);

    const inicio = fechaDelEvento(dto.inicio, ahora);
    if (inicio.getTime() < turno.fechaInicio.getTime()) throw turnoError('FECHA_INVALIDA');
    // Un cambio registrado offline puede llegar después del cierre: se acepta si ocurrió durante el turno
    if (turno.fechaFin && inicio.getTime() >= turno.fechaFin.getTime()) throw turnoError('TURNO_NO_ACTIVO');

    const registro = await this.turnoRepo.registrarUbicacion({
      idTurno: turno.id!,
      idArea: ubicacion.area.idArea,
      idZona: ubicacion.zona?.idZona ?? null,
      inicio,
      fin: turno.fechaFin,
      idCliente,
    });
    if (marcarUbicacionInactiva(turno, ubicacion)) {
      await this.turnoRepo.save(turno);
    }
    return registro;
  }
}
