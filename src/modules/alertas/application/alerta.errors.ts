import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

export type AlertaErrorCode = 'SIN_PERMISO' | 'ALERTA_NO_ENCONTRADA' | 'NOTA_VACIA' | 'COMENTARIO_LARGO' | 'DATOS_INVALIDOS';

export const LARGO_MAXIMO_COMENTARIO = 500;

// Código estable para el cliente + mensaje en español, como el resto de los módulos
export const alertaError = (code: AlertaErrorCode) => {
  switch (code) {
    case 'SIN_PERMISO':
      return new ForbiddenException({ statusCode: 403, code, message: 'Solo un jefe de turno o administrador puede atender alertas' });
    case 'ALERTA_NO_ENCONTRADA':
      return new NotFoundException({ statusCode: 404, code, message: 'La alerta no existe' });
    case 'NOTA_VACIA':
      return new BadRequestException({ statusCode: 400, code, message: 'La alerta ya fue atendida: para agregar una nota escribe un comentario' });
    case 'DATOS_INVALIDOS':
      return new BadRequestException({ statusCode: 400, code, message: 'Los datos de la atención no son válidos' });
    case 'COMENTARIO_LARGO':
      return new BadRequestException({ statusCode: 400, code, message: `El comentario puede tener hasta ${LARGO_MAXIMO_COMENTARIO} caracteres` });
  }
};
