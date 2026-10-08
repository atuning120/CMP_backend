import { BadRequestException } from '@nestjs/common';

// Listas del jefe de turno (historial, alertas) del más reciente al más antiguo: rango de fechas + cursor

export interface RangoPaginadoDto {
  desde?: unknown; // ISO; por defecto los últimos 7 días
  hasta?: unknown; // ISO, exclusiva; por defecto hasta ahora
  antes?: unknown; // cursor: fecha (ISO) del último elemento recibido
  antesId?: unknown; // cursor: id del último elemento recibido
  limite?: unknown;
}

// Posición del último elemento recibido. Se ordena por (fecha, id) y no solo por fecha:
// dos elementos con la misma fecha en el corte de una página no deben perderse ni repetirse
export interface CursorFechaId {
  fecha: Date;
  id: string;
}

export interface RangoPaginado {
  desde: Date; // inclusive
  hasta: Date | null; // exclusiva; null = hasta ahora
  despuesDe: CursorFechaId | null;
  limite: number;
}

const LIMITE_POR_DEFECTO = 30;
const LIMITE_MAXIMO = 50;
const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_POR_DEFECTO = 7;
const DIAS_MAXIMOS = 90;

const rangoInvalido = (message: string) => new BadRequestException({ statusCode: 400, code: 'RANGO_FECHAS_INVALIDO', message });

// undefined si no vino, null si vino pero no es una fecha
const leerFecha = (valor: unknown): Date | null | undefined => {
  if (valor === undefined || valor === '') return undefined;
  const fecha = typeof valor === 'string' ? new Date(valor) : null;
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
};

export const leerRangoPaginado = (dto: RangoPaginadoDto): RangoPaginado => {
  const limiteNumero = Number(dto.limite);
  const limite = Number.isInteger(limiteNumero) && limiteNumero > 0 ? Math.min(limiteNumero, LIMITE_MAXIMO) : LIMITE_POR_DEFECTO;

  const desde = leerFecha(dto.desde);
  const hasta = leerFecha(dto.hasta);
  if (desde === null || hasta === null) throw rangoInvalido('Las fechas del rango no son válidas');
  const fin = hasta ?? new Date();
  const inicio = desde ?? new Date(fin.getTime() - DIAS_POR_DEFECTO * DIA_MS);
  if (inicio >= fin) throw rangoInvalido('La fecha de inicio debe ser anterior a la de término');
  // round y no ceil: un cambio de horario agrega o quita una hora a un rango de días completos
  if (Math.round((fin.getTime() - inicio.getTime()) / DIA_MS) > DIAS_MAXIMOS) {
    throw rangoInvalido(`El rango no puede superar los ${DIAS_MAXIMOS} días`);
  }

  // Sin antesId (versión anterior de la app) el cursor se comporta como "fecha estrictamente anterior":
  // cualquier id es mayor que ''
  const antes = leerFecha(dto.antes);
  const despuesDe = antes ? { fecha: antes, id: typeof dto.antesId === 'string' ? dto.antesId : '' } : null;

  return { desde: inicio, hasta: hasta ?? null, despuesDe, limite };
};
