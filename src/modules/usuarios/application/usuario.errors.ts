import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

export type UsuarioErrorCode =
  | 'SIN_PERMISO'
  | 'ROL_INVALIDO'
  | 'USUARIO_NO_ENCONTRADO'
  | 'ROL_NO_EDITABLE'
  | 'PROPIO_ROL'
  | 'ULTIMO_ADMIN';

// Código estable para el cliente + mensaje en español, como el resto de los módulos
export const usuarioError = (code: UsuarioErrorCode) => {
  switch (code) {
    case 'SIN_PERMISO':
      return new ForbiddenException({ statusCode: 403, code, message: 'Solo un administrador puede gestionar usuarios' });
    case 'ROL_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El rol debe ser VISOR, JEFE_TURNO o ADMIN' });
    case 'USUARIO_NO_ENCONTRADO':
      return new NotFoundException({ statusCode: 404, code, message: 'El usuario no existe' });
    case 'ROL_NO_EDITABLE':
      return new ConflictException({ statusCode: 409, code, message: 'El rol de un operador no se cambia desde el panel web' });
    case 'PROPIO_ROL':
      return new ConflictException({ statusCode: 409, code, message: 'No puedes cambiar tu propio rol' });
    case 'ULTIMO_ADMIN':
      return new ConflictException({ statusCode: 409, code, message: 'Debe quedar al menos un administrador activo' });
  }
};
