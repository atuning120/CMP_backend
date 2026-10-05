import { Injectable, Inject } from '@nestjs/common';
import { TURNO_REPOSITORY } from '../../domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import { TURNO_ESTADO_REPOSITORY } from '../../domain/repositories/turno-estado.repository.port';
import type {
  EstadoOperacionalResumen,
  TurnoEstadoRegistro,
  TurnoEstadoRepositoryPort,
} from '../../domain/repositories/turno-estado.repository.port';
import { MAQUINA_REPOSITORY } from '../../../maquinas/domain/repositories/maquina.repository.port';
import type { MaquinaRepositoryPort, MaquinaResumen } from '../../../maquinas/domain/repositories/maquina.repository.port';
import { GEOCERCA_REPOSITORY } from '../../../geocercas/domain/repositories/geocerca.repository.port';
import type {
  AreaResumen,
  GeocercaRepositoryPort,
  ZonaTrabajoResumen,
} from '../../../geocercas/domain/repositories/geocerca.repository.port';
import { Turno } from '../../domain/entities/turno.entity';
import type { UbicacionTurno } from '../../domain/entities/ubicacion-turno';

export interface UbicacionTurnoDetalle {
  area: AreaResumen | null;
  zona: ZonaTrabajoResumen | null;
}

export type EstadoTurnoDetalle = TurnoEstadoRegistro & { estado: EstadoOperacionalResumen | null };

export interface TurnoActualResult {
  turno: Turno | null;
  maquina: MaquinaResumen | null;
  ubicacion: UbicacionTurnoDetalle | null;
  historialEstados: EstadoTurnoDetalle[];
  // Último turno del operador si fue cerrado por sistema y aún no inicia uno nuevo,
  // para avisarle que debe regularizarlo con su jefe de turno.
  turnoCerradoAutomaticamente: Turno | null;
}

export const detallarUbicacion = async (
  geocercaRepo: GeocercaRepositoryPort,
  ubicacion: UbicacionTurno | null,
): Promise<UbicacionTurnoDetalle | null> => {
  if (!ubicacion) return null;
  const [area, zona] = await Promise.all([
    geocercaRepo.findAreaById(ubicacion.idArea),
    ubicacion.idZona ? geocercaRepo.findZonaById(ubicacion.idZona) : Promise.resolve(null),
  ]);
  return { area, zona };
};

export const detallarHistorial = async (
  turnoEstadoRepo: TurnoEstadoRepositoryPort,
  idTurno: number,
): Promise<EstadoTurnoDetalle[]> => {
  const [historial, catalogo] = await Promise.all([
    turnoEstadoRepo.findHistorial(idTurno),
    turnoEstadoRepo.findCatalogoActivo(),
  ]);
  const porId = new Map(catalogo.map((estado) => [estado.idEstado, estado]));
  return Promise.all(
    historial.map(async (registro) => ({
      ...registro,
      estado: porId.get(registro.idEstado) ?? (await turnoEstadoRepo.findEstadoById(registro.idEstado)),
    })),
  );
};

@Injectable()
export class ObtenerTurnoActualUseCase {
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

  async execute(idOperador: number, ahora: Date = new Date()): Promise<TurnoActualResult> {
    const activo = await this.turnoRepo.findActivoByOperador(idOperador);

    if (activo && !activo.excedeDuracionMaxima(ahora)) {
      const [maquina, ubicacion, historialEstados] = await Promise.all([
        this.maquinaRepo.findById(activo.idMaquina),
        this.turnoRepo.findUbicacionVigente(activo.id!),
        detallarHistorial(this.turnoEstadoRepo, activo.id!),
      ]);
      return {
        turno: activo,
        maquina,
        ubicacion: await detallarUbicacion(this.geocercaRepo, ubicacion),
        historialEstados,
        turnoCerradoAutomaticamente: null,
      };
    }

    // El turno se pasó de 12 h: se cierra ahora mismo aunque el job periódico aún no haya corrido
    if (activo) {
      activo.cerrarAutomaticamente();
      await this.turnoRepo.save(activo);
    }

    const ultimo = await this.turnoRepo.findUltimoByOperador(idOperador);
    return {
      turno: null,
      maquina: null,
      ubicacion: null,
      historialEstados: [],
      turnoCerradoAutomaticamente: ultimo?.estadoActual === 'CERRADO_AUTO' ? ultimo : null,
    };
  }
}
