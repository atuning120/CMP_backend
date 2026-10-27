import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

// Errores de máquinas: código estable para que la app decida qué mostrar, más un mensaje legible.
export type MaquinaErrorCode =
  | 'SIN_PERMISO'
  | 'DATOS_INVALIDOS'
  | 'HOROMETRO_INVALIDO'
  | 'ANIO_INVALIDO'
  | 'CODIGO_DUPLICADO'
  | 'PATENTE_DUPLICADA'
  | 'MAQUINA_NO_ENCONTRADA'
  | 'SIN_CAMBIOS'
  | 'MAQUINA_EN_USO'
  | 'SIN_RESPALDO'
  | 'MAQUINA_MODIFICADA';

export const maquinaError = (code: MaquinaErrorCode, detalle?: string) => {
  switch (code) {
    case 'SIN_PERMISO':
      return new ForbiddenException({ statusCode: 403, code, message: 'Solo un jefe de turno o administrador puede gestionar la flota' });
    case 'DATOS_INVALIDOS':
      return new BadRequestException({ statusCode: 400, code, message: detalle ?? 'Los datos de la máquina no son válidos' });
    case 'HOROMETRO_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El horómetro inicial debe ser un número mayor o igual a 0' });
    case 'ANIO_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El año de fabricación no es válido' });
    case 'CODIGO_DUPLICADO':
      return new ConflictException({ statusCode: 409, code, message: `Ya existe una máquina con el código ${detalle}` });
    case 'PATENTE_DUPLICADA':
      return new ConflictException({ statusCode: 409, code, message: `Ya existe una máquina con la patente ${detalle}` });
    case 'MAQUINA_NO_ENCONTRADA':
      return new NotFoundException({ statusCode: 404, code, message: 'La máquina no existe' });
    case 'SIN_CAMBIOS':
      return new BadRequestException({ statusCode: 400, code, message: 'No hay cambios que guardar' });
    case 'MAQUINA_EN_USO':
      return new ConflictException({
        statusCode: 409,
        code,
        message: `${detalle} tiene un turno en curso: primero hay que cerrarlo para sacarla de operación`,
      });
    case 'MAQUINA_MODIFICADA':
      // detalle: "CF-12 fue modificada por Juan Pérez"
      return new ConflictException({
        statusCode: 409,
        code,
        message: `${detalle} mientras hacías este cambio. Revisa cómo quedó e intenta nuevamente`,
      });
    case 'SIN_RESPALDO':
      return new ConflictException({ statusCode: 409, code, message: 'La máquina no tiene un respaldo que devolver' });
  }
};
