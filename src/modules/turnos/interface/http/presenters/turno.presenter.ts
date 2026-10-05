import type { Turno } from '../../../domain/entities/turno.entity';
import type { TurnoEstadoRegistro } from '../../../domain/repositories/turno-estado.repository.port';
import type { TurnoActualResult } from '../../../application/use-cases/obtener-turno-actual.use-case';

const presentTurno = (turno: Turno) => ({
  id: turno.id,
  idCliente: turno.idCliente,
  idOperador: turno.idOperador,
  idMaquina: turno.idMaquina,
  estado: turno.estadoActual,
  fechaInicio: turno.fechaInicio.toISOString(),
  fechaFin: turno.fechaFin?.toISOString() ?? null,
  horometroInicial: turno.horometroInicial,
  horometroFinal: turno.horometroFinal,
  conflicto: turno.conflicto,
  conflictoDetalle: turno.conflictoDetalle,
});

export const presentTurnoEstado = (registro: TurnoEstadoRegistro) => ({
  id: registro.idTurnoEstado,
  idCliente: registro.idCliente,
  idTurno: registro.idTurno,
  idEstado: registro.idEstado,
  inicio: registro.inicio.toISOString(),
  fin: registro.fin?.toISOString() ?? null,
  comentario: registro.comentario,
});

export const presentTurnoActual = ({
  turno,
  maquina,
  ubicacion,
  historialEstados,
  turnoCerradoAutomaticamente,
}: TurnoActualResult) => ({
  turno: turno
    ? {
        ...presentTurno(turno),
        maquina,
        area: ubicacion?.area ?? null,
        zona: ubicacion?.zona ?? null,
        historialEstados: historialEstados.map((registro) => ({ ...presentTurnoEstado(registro), estado: registro.estado })),
      }
    : null,
  turnoCerradoAutomaticamente: turnoCerradoAutomaticamente ? presentTurno(turnoCerradoAutomaticamente) : null,
});

export const presentTurnoCerrado = presentTurno;
