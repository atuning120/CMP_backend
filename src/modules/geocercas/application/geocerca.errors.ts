import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

export type GeocercaErrorCode =
  | 'SIN_PERMISO'
  | 'DATOS_INVALIDOS'
  | 'POLIGONO_INVALIDO'
  | 'AREA_NO_ENCONTRADA'
  | 'ZONA_NO_ENCONTRADA'
  | 'ZONA_FUERA_DEL_AREA'
  | 'ZONAS_FUERA_DEL_AREA';

// Código estable para el cliente + mensaje en español, como el resto de los módulos
export const geocercaError = (code: GeocercaErrorCode, detalle?: string) => {
  switch (code) {
    case 'SIN_PERMISO':
      return new ForbiddenException({ statusCode: 403, code, message: 'Solo un administrador puede modificar geocercas' });
    case 'DATOS_INVALIDOS':
      return new BadRequestException({ statusCode: 400, code, message: detalle ?? 'Datos de la geocerca incompletos' });
    case 'POLIGONO_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: detalle ?? 'El polígono no es válido' });
    case 'AREA_NO_ENCONTRADA':
      return new NotFoundException({ statusCode: 404, code, message: 'El área no existe o está inactiva' });
    case 'ZONA_NO_ENCONTRADA':
      return new NotFoundException({ statusCode: 404, code, message: 'La zona no existe o está inactiva' });
    case 'ZONA_FUERA_DEL_AREA':
      return new ConflictException({ statusCode: 409, code, message: 'La zona debe quedar dentro del polígono de su área' });
    case 'ZONAS_FUERA_DEL_AREA':
      return new ConflictException({ statusCode: 409, code, message: detalle ?? 'Hay zonas que quedarían fuera del área' });
  }
};
