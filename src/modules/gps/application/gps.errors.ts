import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

// Errores de GPS: código estable para que el panel decida qué mostrar, más un mensaje legible
export type GpsErrorCode =
  | 'SIN_PERMISO'
  | 'DATOS_INVALIDOS'
  | 'IMEI_INVALIDO'
  | 'IMEI_DUPLICADO'
  | 'GPS_NO_ENCONTRADO'
  | 'MAQUINA_NO_ENCONTRADA'
  | 'GPS_INACTIVO'
  | 'GPS_ASIGNADO'
  | 'GPS_SIN_MAQUINA'
  | 'SIN_CAMBIOS'
  | 'MAQUINA_CON_GPS'
  | 'GPS_MODIFICADO';

export const gpsError = (code: GpsErrorCode, detalle?: string) => {
  switch (code) {
    case 'SIN_PERMISO':
      return new ForbiddenException({ statusCode: 403, code, message: 'Solo un jefe de turno o administrador puede gestionar los GPS' });
    case 'DATOS_INVALIDOS':
      return new BadRequestException({ statusCode: 400, code, message: detalle ?? 'Los datos del GPS no son válidos' });
    case 'IMEI_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El IMEI no es válido: revisa los 15 dígitos de la etiqueta del equipo' });
    case 'IMEI_DUPLICADO':
      return new ConflictException({ statusCode: 409, code, message: `Ya hay un GPS registrado con el IMEI ${detalle}` });
    case 'GPS_NO_ENCONTRADO':
      return new NotFoundException({ statusCode: 404, code, message: 'El GPS no existe' });
    case 'MAQUINA_NO_ENCONTRADA':
      return new NotFoundException({ statusCode: 404, code, message: 'La máquina no existe' });
    case 'GPS_INACTIVO':
      return new ConflictException({ statusCode: 409, code, message: 'El GPS está dado de baja: reactívalo antes de vincularlo' });
    case 'GPS_ASIGNADO':
      return new ConflictException({ statusCode: 409, code, message: `El GPS está en ${detalle}: desvincúlalo antes de darlo de baja` });
    case 'GPS_SIN_MAQUINA':
      return new ConflictException({ statusCode: 409, code, message: 'El GPS no está vinculado a ninguna máquina' });
    case 'SIN_CAMBIOS':
      return new BadRequestException({ statusCode: 400, code, message: detalle ?? 'No hay cambios que guardar' });
    case 'MAQUINA_CON_GPS':
      // detalle: "CF-12 ya tiene el GPS 8640..."
      return new ConflictException({ statusCode: 409, code, message: `${detalle}. Confirma que quieres reemplazarlo` });
    case 'GPS_MODIFICADO':
      return new ConflictException({
        statusCode: 409,
        code,
        message: 'Otra persona cambió este GPS o la máquina mientras hacías el cambio. Revisa cómo quedó e intenta nuevamente',
      });
  }
};
