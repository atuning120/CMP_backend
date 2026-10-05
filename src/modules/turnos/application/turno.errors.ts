import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

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
  | 'TURNO_CERRADO_AUTOMATICAMENTE';

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
      return new NotFoundException({ statusCode: 404, code, message: 'La máquina no existe o no está activa' });
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
    case 'TURNO_CERRADO_AUTOMATICAMENTE':
      return new ConflictException({
        statusCode: 409,
        code,
        message: 'El turno superó las 12 horas y fue cerrado automáticamente',
      });
  }
};
