import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

export type AppMovilErrorCode =
  | 'SIN_PERMISO'
  | 'DESCARGA_NO_CONFIGURADA'
  | 'APK_NO_PUBLICADA'
  | 'VERSION_NO_ENCONTRADA'
  | 'VERSION_INVALIDA'
  | 'VERSION_EXISTENTE'
  | 'NOTAS_INVALIDAS'
  | 'ARCHIVO_INVALIDO'
  | 'ARCHIVO_NO_SUBIDO';

export const appMovilError = (code: AppMovilErrorCode) => {
  switch (code) {
    case 'SIN_PERMISO':
      return new ForbiddenException({ statusCode: 403, code, message: 'Solo un administrador puede administrar las versiones de la app' });
    case 'DESCARGA_NO_CONFIGURADA':
      return new ServiceUnavailableException({ statusCode: 503, code, message: 'La descarga de la app no está disponible en este momento' });
    case 'APK_NO_PUBLICADA':
      return new NotFoundException({ statusCode: 404, code, message: 'Todavía no hay una versión de la app publicada' });
    case 'VERSION_NO_ENCONTRADA':
      return new NotFoundException({ statusCode: 404, code, message: 'Esa versión de la app no existe o fue retirada' });
    case 'VERSION_INVALIDA':
      return new BadRequestException({ statusCode: 400, code, message: 'La versión debe tener el formato 1.2.3 (tres números separados por puntos)' });
    case 'VERSION_EXISTENTE':
      return new ConflictException({ statusCode: 409, code, message: 'Esa versión ya está publicada: usa un número de versión nuevo' });
    case 'NOTAS_INVALIDAS':
      return new BadRequestException({ statusCode: 400, code, message: 'Las notas de la versión pueden tener hasta 2000 caracteres' });
    case 'ARCHIVO_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El archivo debe ser un instalador .apk de Android de hasta 300 MB' });
    case 'ARCHIVO_NO_SUBIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El archivo no terminó de subirse. Vuelve a intentarlo' });
  }
};
