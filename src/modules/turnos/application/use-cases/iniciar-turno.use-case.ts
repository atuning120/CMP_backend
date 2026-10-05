import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { TURNO_REPOSITORY } from '../../domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import { TURNO_ESTADO_REPOSITORY } from '../../domain/repositories/turno-estado.repository.port';
import type { TurnoEstadoRepositoryPort } from '../../domain/repositories/turno-estado.repository.port';
import { MAQUINA_REPOSITORY } from '../../../maquinas/domain/repositories/maquina.repository.port';
import type { MaquinaRepositoryPort } from '../../../maquinas/domain/repositories/maquina.repository.port';
import { GEOCERCA_REPOSITORY } from '../../../geocercas/domain/repositories/geocerca.repository.port';
import type {
  AreaResumen,
  GeocercaRepositoryPort,
  ZonaTrabajoResumen,
} from '../../../geocercas/domain/repositories/geocerca.repository.port';
import { IniciarTurnoDto } from '../dtos/iniciar-turno.dto';
import { Turno } from '../../domain/entities/turno.entity';
import { turnoError } from '../turno.errors';
import { fechaDelEvento, validarIdCliente } from '../datos-cliente';
import { detallarHistorial, detallarUbicacion } from './obtener-turno-actual.use-case';
import type { TurnoActualResult } from './obtener-turno-actual.use-case';

/**
 * Inicia un turno. Pensado para la app offline-first: el inicio puede haber ocurrido sin conexión
 * y llegar tarde, por lo que los choques con el estado actual del servidor (máquina u operador con
 * otro turno abierto, catálogos dados de baja) NO rechazan el turno: se acepta y queda marcado
 * como conflicto para revisión del jefe de turno. Solo se rechazan datos imposibles de guardar.
 */
@Injectable()
export class IniciarTurnoUseCase {
  constructor(
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
    @Inject(MAQUINA_REPOSITORY)
    private readonly maquinaRepo: MaquinaRepositoryPort,
    @Inject(GEOCERCA_REPOSITORY)
    private readonly geocercaRepo: GeocercaRepositoryPort,
    @Inject(TURNO_ESTADO_REPOSITORY)
    private readonly turnoEstadoRepo: TurnoEstadoRepositoryPort,
  ) {}

  async execute(dto: IniciarTurnoDto, ahora: Date = new Date()): Promise<TurnoActualResult> {
    const idCliente = validarIdCliente(dto.idCliente);

    // Reintento de una operación ya sincronizada: se responde lo mismo sin duplicar
    if (idCliente) {
      const existente = await this.turnoRepo.findByIdCliente(idCliente);
      if (existente) {
        if (existente.idOperador !== dto.idOperador) {
          throw new ConflictException({ statusCode: 409, code: 'ID_CLIENTE_EN_USO', message: 'Operación ya registrada por otro usuario' });
        }
        return this.resultado(existente);
      }
    }

    if (!Number.isFinite(dto.horometroInicial) || dto.horometroInicial < 0) {
      throw turnoError('HOROMETRO_INVALIDO');
    }
    const fechaInicio = fechaDelEvento(dto.fechaInicio, ahora);

    const maquina = Number.isInteger(dto.idMaquina) ? await this.maquinaRepo.findById(dto.idMaquina) : null;
    if (!maquina) {
      throw turnoError('MAQUINA_NO_DISPONIBLE');
    }
    const { area, zona } = await this.validarUbicacion(dto.idArea, dto.idZona);

    const nuevoTurno = new Turno(
      null, // DB autogenerates id_turno
      dto.idOperador,
      dto.idMaquina,
      fechaInicio,
      null,
      dto.horometroInicial,
      null,
      'EN_CURSO',
      idCliente,
    );

    if (maquina.estado !== 'ACTIVA') {
      nuevoTurno.marcarConflicto(`La máquina ${maquina.nombre} no estaba activa al sincronizar`);
    }
    if (area.estado !== 'ACTIVA') {
      nuevoTurno.marcarConflicto(`El área ${area.nombre} no estaba activa al sincronizar`);
    }
    if (zona && zona.estado !== 'ACTIVA') {
      nuevoTurno.marcarConflicto(`La zona ${zona.nombre} no estaba activa al sincronizar`);
    }

    const turnoOperador = await this.liberarSiExcedido(await this.turnoRepo.findActivoByOperador(dto.idOperador), ahora);
    if (turnoOperador) {
      nuevoTurno.marcarConflicto(`El operador tenía abierto el turno #${turnoOperador.id}`);
    }
    const turnoMaquina = await this.liberarSiExcedido(await this.turnoRepo.findActivoByMaquina(dto.idMaquina), ahora);
    if (turnoMaquina && turnoMaquina.id !== turnoOperador?.id) {
      nuevoTurno.marcarConflicto(`La máquina tenía abierto el turno #${turnoMaquina.id} de otro operador`);
    }

    const guardado = await this.turnoRepo.iniciar(nuevoTurno, { idArea: area.idArea, idZona: zona?.idZona ?? null });
    return {
      turno: guardado,
      maquina,
      ubicacion: { area, zona },
      historialEstados: [],
      turnoCerradoAutomaticamente: null,
    };
  }

  private async resultado(turno: Turno): Promise<TurnoActualResult> {
    const [maquina, ubicacion, historialEstados] = await Promise.all([
      this.maquinaRepo.findById(turno.idMaquina),
      this.turnoRepo.findUbicacionVigente(turno.id!),
      detallarHistorial(this.turnoEstadoRepo, turno.id!),
    ]);
    return {
      turno,
      maquina,
      ubicacion: await detallarUbicacion(this.geocercaRepo, ubicacion),
      historialEstados,
      turnoCerradoAutomaticamente: null,
    };
  }

  private async validarUbicacion(
    idArea: number,
    idZona: number | null,
  ): Promise<{ area: AreaResumen; zona: ZonaTrabajoResumen | null }> {
    const area = Number.isInteger(idArea) ? await this.geocercaRepo.findAreaById(idArea) : null;
    if (!area) {
      throw turnoError('AREA_NO_DISPONIBLE');
    }
    if (idZona === null) {
      return { area, zona: null };
    }
    const zona = Number.isInteger(idZona) ? await this.geocercaRepo.findZonaById(idZona) : null;
    if (!zona || zona.idArea !== area.idArea) {
      throw turnoError('ZONA_NO_DISPONIBLE');
    }
    return { area, zona };
  }

  // Un turno olvidado (> 12 h) no debe bloquear el inicio de uno nuevo: se cierra automáticamente.
  private async liberarSiExcedido(turno: Turno | null, ahora: Date): Promise<Turno | null> {
    if (!turno || !turno.excedeDuracionMaxima(ahora)) {
      return turno;
    }
    turno.cerrarAutomaticamente();
    await this.turnoRepo.save(turno);
    return null;
  }
}
