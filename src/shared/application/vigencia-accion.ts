/*
 * Acciones del jefe de turno hechas sin señal en la app (cambiar estado, editar, incorporar, cerrar un turno): llegan
 * con la fecha en que se hicieron. La app las retiene para confirmar desde las 24 h y las descarta a las 72 h; el
 * Backend es el respaldo: pasado este plazo, según la hora del servidor, no las aplica. Las atenciones de alertas no
 * vencen y no pasan por aquí.
 */
export const VIGENCIA_ACCION_SIN_SENAL_HORAS = 72;

export const MENSAJE_ACCION_VENCIDA = `La acción se hizo hace más de ${VIGENCIA_ACCION_SIN_SENAL_HORAS} horas sin conexión y ya no se aplica. Si aún corresponde, hazla de nuevo`;

export const accionVencida = (fechaAccion: Date, ahora: Date) =>
  ahora.getTime() - fechaAccion.getTime() > VIGENCIA_ACCION_SIN_SENAL_HORAS * 60 * 60 * 1000;
