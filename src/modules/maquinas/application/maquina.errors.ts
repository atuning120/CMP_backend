import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

// Errores de máquinas: código estable para que la app decida qué mostrar, más un mensaje legible.
export type MaquinaErrorCode =
  | 'SIN_PERMISO'
  | 'DATOS_INVALIDOS'
  | 'HOROMETRO_INVALIDO'
  | 'ANIO_INVALIDO'
  | 'CODIGO_DUPLICADO'
  | 'PATENTE_DUPLICADA';

export const maquinaError = (code: MaquinaErrorCode, detalle?: string) => {
  switch (code) {
    case 'SIN_PERMISO':
      return new ForbiddenException({ statusCode: 403, code, message: 'Solo un jefe de turno o administrador puede incorporar máquinas' });
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
  }
};
