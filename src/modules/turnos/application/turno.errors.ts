import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DURACION_MAXIMA_TURNO_HORAS } from '../domain/entities/turno.entity';
import { MENSAJE_ACCION_VENCIDA } from '../../../shared/application/vigencia-accion';

// Errores de turnos: código estable para que la app decida qué mostrar, más un mensaje legible.
export type TurnoErrorCode =
  | 'SIN_OPERADOR'
  | 'HOROMETRO_INVALIDO'
  | 'FECHA_INVALIDA'
  | 'ID_CLIENTE_INVALIDO'
  | 'ESTADO_NO_DISPONIBLE'
  | 'MAQUINA_NO_DISPONIBLE'
  | 'AREA_NO_DISPONIBLE'
  | 'ZONA_NO_DISPONIBLE'
  | 'MAQUINA_CON_TURNO_ACTIVO'
  | 'OPERADOR_CON_TURNO_ACTIVO'
  | 'TURNO_NO_ENCONTRADO'
  | 'TURNO_NO_ACTIVO'
  | 'TURNO_CERRADO_AUTOMATICAMENTE'
  | 'SIN_PERMISO_CIERRE'
  | 'MOTIVO_INVALIDO'
  | 'ACCION_VENCIDA'
  | 'SIN_TURNO_EN_CURSO';

export const turnoError = (code: TurnoErrorCode) => {
  switch (code) {
    case 'SIN_OPERADOR':
      return new ForbiddenException({ statusCode: 403, code, message: 'Solo un operador puede gestionar turnos' });
    case 'HOROMETRO_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El horómetro ingresado no es válido' });
    case 'FECHA_INVALIDA':
      return new BadRequestException({ statusCode: 400, code, message: 'La fecha informada no es válida' });
    case 'ID_CLIENTE_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El identificador de la operación no es válido' });
    case 'ESTADO_NO_DISPONIBLE':
      return new NotFoundException({ statusCode: 404, code, message: 'El estado operacional no existe' });
    case 'MAQUINA_NO_DISPONIBLE':
      return new NotFoundException({ statusCode: 404, code, message: 'La máquina no existe' });
    case 'AREA_NO_DISPONIBLE':
      return new NotFoundException({ statusCode: 404, code, message: 'El área no existe o no está activa' });
    case 'ZONA_NO_DISPONIBLE':
      return new NotFoundException({
        statusCode: 404,
        code,
        message: 'La zona de trabajo no existe, no está activa o no pertenece al área seleccionada',
      });
    case 'MAQUINA_CON_TURNO_ACTIVO':
      return new ConflictException({ statusCode: 409, code, message: 'La máquina ya tiene un turno activo' });
    case 'OPERADOR_CON_TURNO_ACTIVO':
      return new ConflictException({ statusCode: 409, code, message: 'El operador ya tiene un turno activo' });
    case 'TURNO_NO_ENCONTRADO':
      return new NotFoundException({ statusCode: 404, code, message: 'Turno no encontrado' });
    case 'TURNO_NO_ACTIVO':
      return new ConflictException({ statusCode: 409, code, message: 'El turno ya se encuentra cerrado' });
    case 'SIN_PERMISO_CIERRE':
      return new ForbiddenException({ statusCode: 403, code, message: 'Solo un jefe de turno o administrador puede cerrar el turno de un operador' });
    case 'ACCION_VENCIDA':
      return new BadRequestException({ statusCode: 400, code, message: MENSAJE_ACCION_VENCIDA });
    case 'MOTIVO_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'Indica el motivo del cierre (hasta 100 caracteres)' });
    case 'SIN_TURNO_EN_CURSO':
      return new ConflictException({
        statusCode: 409,
        code,
        message: 'La máquina no tiene un turno en curso. Puede que el operador u otro jefe de turno ya lo haya cerrado',
      });
    case 'TURNO_CERRADO_AUTOMATICAMENTE':
      return new ConflictException({
        statusCode: 409,
        code,
        message: `El turno superó las ${DURACION_MAXIMA_TURNO_HORAS} horas y fue cerrado automáticamente`,
      });
  }
};

const formatoHora = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const formatoDia = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit' });
// "31/12" (el separador de es-CL cambia según la versión de ICU)
const dia = (fecha: Date) => {
  const partes = formatoDia.formatToParts(fecha);
  return `${partes.find((p) => p.type === 'day')?.value}/${partes.find((p) => p.type === 'month')?.value}`;
};

/**
 * El jefe de turno cerró sin señal un turno que, cuando llegó al servidor, ya estaba cerrado (gana el primer cierre).
 * por: quién lo cerró (el operador, otro jefe de turno o el sistema); la fecha va en hora de Chile, con el día si no es hoy
 */
export const turnoYaCerrado = (por: string, fecha: Date, ahora: Date = new Date()) => {
  const otroDia = dia(fecha) === dia(ahora) ? '' : ` del ${dia(fecha)}`;
  return new ConflictException({
    statusCode: 409,
    code: 'TURNO_YA_CERRADO',
    message: `El turno ya fue cerrado por ${por} a las ${formatoHora.format(fecha)}${otroDia}`,
  });
};
