import { Inject, Injectable } from '@nestjs/common';
import { ALERTA_TURNO_REPOSITORY } from '../../domain/repositories/alerta-turno.repository.port';
import type { AlertaTurno, AlertaTurnoRepositoryPort } from '../../domain/repositories/alerta-turno.repository.port';
import type { NovedadAlertas } from '../ports/publicador-alertas.port';

// Las alertas no se guardan: aparecen solas en TURNO cuando un turno cruza las 10 h o el sistema lo cierra, y en
// TURNO_ESTADO cuando el operador marca una mantención o falla. Se miran
// las de las últimas 24 h y no solo las del último minuto porque su fecha puede quedar atrás: el cierre automático
// lleva la hora del límite (no la de la revisión) y un turno sincronizado sin conexión llega con sus horas reales
const VENTANA_MS = 24 * 60 * 60 * 1000;
const LIMITE = 200;

// Lo que decide si una alerta sigue activa y cómo se muestra: fin de la detención, estado y cierre del turno y su
// horómetro final. No entran las horas de la jornada (cambian cada minuto: no son un cambio de estado)
const firma = (a: AlertaTurno) =>
  [a.detencion?.fin?.getTime() ?? '', a.turno.estado, a.turno.horaTermino?.getTime() ?? '', a.turno.horometroFinal ?? ''].join('|');

/**
 * Compara las alertas de la ventana con las de la revisión anterior y devuelve las que no estaban y las que cambiaron
 * de estado, o null si no hay nada que avisar (ni nuevas, ni cambios, ni otro contador). La primera revisión solo
 * registra lo que ya existe: al reiniciar el Backend no se vuelven a avisar las alertas viejas.
 */
@Injectable()
export class DetectarAlertasNuevasUseCase {
  // id de alerta -> firma de su estado en la revisión anterior
  private vistas: Map<string, string> | null = null;
  private activas: number | null = null;

  constructor(
    @Inject(ALERTA_TURNO_REPOSITORY)
    private readonly alertaRepo: AlertaTurnoRepositoryPort,
  ) {}

  async execute(ahora: Date = new Date()): Promise<NovedadAlertas | null> {
    const [alertas, activas] = await Promise.all([
      this.alertaRepo.listar({
        incluirExtendidos: true,
        incluirCierresAutomaticos: true,
        incluirMantenciones: true,
        estado: 'TODAS',
        desde: new Date(ahora.getTime() - VENTANA_MS),
        hasta: null,
        despuesDe: null,
        limite: LIMITE,
      }),
      this.alertaRepo.contarActivas(),
    ]);

    const anteriores = this.vistas;
    const activasAntes = this.activas;
    // Solo las de la ventana actual: el mapa no crece con el tiempo
    this.vistas = new Map(alertas.map((a) => [a.id, firma(a)]));
    this.activas = activas;
    if (!anteriores) return null;

    const nuevas = alertas.filter((a) => !anteriores.has(a.id));
    const actualizadas = alertas.filter((a) => anteriores.has(a.id) && anteriores.get(a.id) !== firma(a));
    if (nuevas.length === 0 && actualizadas.length === 0 && activas === activasAntes) return null;
    return { nuevas, actualizadas, activas };
  }
}
