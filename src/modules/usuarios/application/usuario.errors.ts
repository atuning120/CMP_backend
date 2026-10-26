import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

export type UsuarioErrorCode =
  | 'SIN_PERMISO'
  | 'ROL_INVALIDO'
  | 'USUARIO_NO_ENCONTRADO'
  | 'ROL_NO_EDITABLE'
  | 'PROPIO_ROL'
  | 'ULTIMO_ADMIN'
  | 'DATOS_INCOMPLETOS'
  | 'NOMBRE_DEMASIADO_LARGO'
  | 'EMAIL_INVALIDO'
  | 'RUT_INVALIDO'
  | 'TELEFONO_INVALIDO'
  | 'EMAIL_EN_USO'
  | 'RUT_EN_USO'
  | 'ESTADO_INVALIDO'
  | 'PROPIO_ESTADO'
  | 'PASSWORD_REQUERIDA'
  | 'MICROSOFT_SIN_APP'
  | 'PROPIO_ACCESO'
  | 'ADMIN_PRINCIPAL'
  | 'ADMIN_PRINCIPAL_SOLO_PROPIO'
  | 'EMAIL_PRINCIPAL_FIJO';

// Código estable para el cliente + mensaje en español, como el resto de los módulos
export const usuarioError = (code: UsuarioErrorCode) => {
  switch (code) {
    case 'SIN_PERMISO':
      return new ForbiddenException({ statusCode: 403, code, message: 'Solo un administrador puede gestionar usuarios' });
    case 'ROL_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El rol indicado no es válido' });
    case 'USUARIO_NO_ENCONTRADO':
      return new NotFoundException({ statusCode: 404, code, message: 'El usuario no existe' });
    case 'ROL_NO_EDITABLE':
      return new ConflictException({ statusCode: 409, code, message: 'El rol de un operador no se cambia desde el panel web' });
    case 'PROPIO_ROL':
      return new ConflictException({ statusCode: 409, code, message: 'No puedes cambiar tu propio rol' });
    case 'ULTIMO_ADMIN':
      return new ConflictException({ statusCode: 409, code, message: 'Debe quedar al menos un administrador activo' });
    case 'DATOS_INCOMPLETOS':
      return new BadRequestException({ statusCode: 400, code, message: 'Faltan datos obligatorios del usuario (nombre, apellido o correo)' });
    case 'NOMBRE_DEMASIADO_LARGO':
      return new BadRequestException({ statusCode: 400, code, message: 'El nombre es demasiado largo (hasta 50 caracteres el nombre y 50 el apellido)' });
    case 'EMAIL_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El correo no es válido' });
    case 'RUT_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El RUT no es válido' });
    case 'TELEFONO_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El teléfono puede tener hasta 20 caracteres' });
    case 'EMAIL_EN_USO':
      return new ConflictException({ statusCode: 409, code, message: 'Ya existe un usuario con ese correo' });
    case 'RUT_EN_USO':
      return new ConflictException({ statusCode: 409, code, message: 'Ya existe un operador con ese RUT' });
    case 'ESTADO_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'Debe indicar si el usuario queda activo o inactivo' });
    case 'PROPIO_ESTADO':
      return new ConflictException({ statusCode: 409, code, message: 'No puedes desactivar tu propia cuenta' });
    case 'PASSWORD_REQUERIDA':
      return new BadRequestException({ statusCode: 400, code, message: 'Si no entra con Microsoft, el usuario necesita una contraseña' });
    case 'MICROSOFT_SIN_APP':
      return new BadRequestException({ statusCode: 400, code, message: 'Un operador entra a la app móvil con contraseña: no puede usar Microsoft' });
    case 'PROPIO_ACCESO':
      return new ConflictException({ statusCode: 409, code, message: 'No puedes cambiar tu propia contraseña ni tu forma de ingreso desde aquí' });
    case 'ADMIN_PRINCIPAL':
      return new ConflictException({ statusCode: 409, code, message: 'El administrador principal no se puede desactivar ni cambiar de rol' });
    case 'ADMIN_PRINCIPAL_SOLO_PROPIO':
      return new ForbiddenException({ statusCode: 403, code, message: 'Solo el administrador principal puede editar su propia cuenta' });
    case 'EMAIL_PRINCIPAL_FIJO':
      return new ConflictException({
        statusCode: 409,
        code,
        message: 'El correo del administrador principal se cambia en ADMIN_PRINCIPAL_EMAIL, en la configuración del Backend',
      });
  }
};
