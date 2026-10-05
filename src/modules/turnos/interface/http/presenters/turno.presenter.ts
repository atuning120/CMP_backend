import type { Turno } from '../../../domain/entities/turno.entity';
import type { TurnoActualResult } from '../../../application/use-cases/obtener-turno-actual.use-case';

const presentTurno = (turno: Turno) => ({
  id: turno.id,
  idOperador: turno.idOperador,
  idMaquina: turno.idMaquina,
  estado: turno.estadoActual,
  fechaInicio: turno.fechaInicio.toISOString(),
  fechaFin: turno.fechaFin?.toISOString() ?? null,
  horometroInicial: turno.horometroInicial,
  horometroFinal: turno.horometroFinal,
});

export const presentTurnoActual = ({ turno, maquina, ubicacion, turnoCerradoAutomaticamente }: TurnoActualResult) => ({
  turno: turno
    ? {
        ...presentTurno(turno),
        maquina,
        area: ubicacion?.area ?? null,
        zona: ubicacion?.zona ?? null,
      }
    : null,
  turnoCerradoAutomaticamente: turnoCerradoAutomaticamente ? presentTurno(turnoCerradoAutomaticamente) : null,
});

export const presentTurnoCerrado = presentTurno;
