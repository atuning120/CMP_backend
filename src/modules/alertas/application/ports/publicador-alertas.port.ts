import type { AlertaTurno, AtencionAlerta } from '../../domain/repositories/alerta-turno.repository.port';

export const PUBLICADOR_ALERTAS = Symbol('PUBLICADOR_ALERTAS');

// Alertas que aparecieron desde la revisión anterior y el contador de operadores con más de 10 h ahora mismo
export interface NovedadAlertas {
  nuevas: AlertaTurno[];
  activas: number;
}

// Alguien atendió una alerta o le agregó una nota: todas sus atenciones, de la primera a la última
export interface AtencionPublicada {
  idAlerta: string;
  atenciones: AtencionAlerta[];
}

// Avisa en tiempo real de las alertas nuevas y de sus atenciones (el panel web las recibe por WebSocket)
export interface PublicadorAlertasPort {
  publicar(novedad: NovedadAlertas): void;
  publicarAtencion(atencion: AtencionPublicada): void;
}
