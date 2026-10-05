import { Injectable, Inject } from '@nestjs/common';
import { TURNO_REPOSITORY } from '../../domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
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
import type { TurnoActualResult } from './obtener-turno-actual.use-case';

@Injectable()
export class IniciarTurnoUseCase {
  constructor(
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
    @Inject(MAQUINA_REPOSITORY)
    private readonly maquinaRepo: MaquinaRepositoryPort,
    @Inject(GEOCERCA_REPOSITORY)
    private readonly geocercaRepo: GeocercaRepositoryPort,
  ) {}

  async execute(dto: IniciarTurnoDto): Promise<TurnoActualResult> {
    if (!Number.isFinite(dto.horometroInicial) || dto.horometroInicial < 0) {
      throw turnoError('HOROMETRO_INVALIDO');
    }

    const maquina = await this.maquinaRepo.findById(dto.idMaquina);
    if (!maquina || maquina.estado !== 'ACTIVA') {
      throw turnoError('MAQUINA_NO_DISPONIBLE');
    }

    const { area, zona } = await this.validarUbicacion(dto.idArea, dto.idZona);

    const ahora = new Date();

    const turnoExistenteOperador = await this.liberarSiExcedido(
      await this.turnoRepo.findActivoByOperador(dto.idOperador),
      ahora,
    );
    if (turnoExistenteOperador) {
      throw turnoError('OPERADOR_CON_TURNO_ACTIVO');
    }

    const turnoExistenteMaquina = await this.liberarSiExcedido(
      await this.turnoRepo.findActivoByMaquina(dto.idMaquina),
      ahora,
    );
    if (turnoExistenteMaquina) {
      throw turnoError('MAQUINA_CON_TURNO_ACTIVO');
    }

    const nuevoTurno = new Turno(
      null, // DB autogenerates id_turno
      dto.idOperador,
      dto.idMaquina,
      ahora,
      null,
      dto.horometroInicial,
      null,
      'EN_CURSO',
    );

    const guardado = await this.turnoRepo.iniciar(nuevoTurno, { idArea: area.idArea, idZona: zona?.idZona ?? null });
    return { turno: guardado, maquina, ubicacion: { area, zona }, turnoCerradoAutomaticamente: null };
  }

  private async validarUbicacion(
    idArea: number,
    idZona: number | null,
  ): Promise<{ area: AreaResumen; zona: ZonaTrabajoResumen | null }> {
    const area = Number.isInteger(idArea) ? await this.geocercaRepo.findAreaById(idArea) : null;
    if (!area || area.estado !== 'ACTIVA') {
      throw turnoError('AREA_NO_DISPONIBLE');
    }
    if (idZona === null) {
      return { area, zona: null };
    }
    const zona = Number.isInteger(idZona) ? await this.geocercaRepo.findZonaById(idZona) : null;
    if (!zona || zona.estado !== 'ACTIVA' || zona.idArea !== area.idArea) {
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
