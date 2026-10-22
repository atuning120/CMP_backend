import type { AlertaTurno } from '../../domain/repositories/alerta-turno.repository.port';

export const PUBLICADOR_ALERTAS = Symbol('PUBLICADOR_ALERTAS');

// Alertas que aparecieron desde la revisión anterior y el contador de operadores con más de 10 h ahora mismo
export interface NovedadAlertas {
  nuevas: AlertaTurno[];
  activas: number;
}

// Avisa en tiempo real de las alertas nuevas (el panel web las recibe por WebSocket)
export interface PublicadorAlertasPort {
  publicar(novedad: NovedadAlertas): void;
}
