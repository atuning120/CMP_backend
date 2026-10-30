import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { ErrorFilaEp } from '../domain/ports/lector-excel-ep.port';

export type ReporteErrorCode =
  | 'SIN_PERMISO'
  | 'PERIODO_INVALIDO'
  | 'RANGO_INVALIDO'
  | 'ARCHIVO_INVALIDO'
  | 'EXCEL_CON_ERRORES'
  | 'CARGA_EXISTENTE'
  | 'CARGA_SIMULTANEA'
  | 'CARGA_NO_ENCONTRADA'
  | 'DASHBOARD_INVALIDO'
  | 'METABASE_NO_CONFIGURADO'
  | 'METABASE_NO_DISPONIBLE';

export const reporteError = (code: ReporteErrorCode, errores?: ErrorFilaEp[]) => {
  switch (code) {
    case 'SIN_PERMISO':
      return new ForbiddenException({ statusCode: 403, code, message: 'No tienes permiso para esta acción' });
    case 'PERIODO_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El período debe tener el formato AAAA-MM' });
    case 'RANGO_INVALIDO':
      return new BadRequestException({
        statusCode: 400,
        code,
        message: 'El rango del estado de pago debe ir de fechaDesde a fechaHasta (AAAA-MM-DD), con a lo más 62 días y cruzando el mes del período',
      });
    case 'ARCHIVO_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El archivo debe ser un Excel .xlsx de hasta 10 MB' });
    case 'EXCEL_CON_ERRORES':
      return new BadRequestException({ statusCode: 400, code, message: 'El Excel tiene errores: corrígelos y vuelve a subirlo', errores });
    case 'CARGA_EXISTENTE':
      return new ConflictException({ statusCode: 409, code, message: 'Ese mes ya tiene un estado de pago cargado: confirma que quieres reemplazarlo' });
    case 'CARGA_SIMULTANEA':
      return new ConflictException({ statusCode: 409, code, message: 'Otra persona cargó ese mes al mismo tiempo. Revisa y vuelve a intentarlo' });
    case 'CARGA_NO_ENCONTRADA':
      return new NotFoundException({ statusCode: 404, code, message: 'Ese mes no tiene un estado de pago cargado' });
    case 'DASHBOARD_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El dashboard debe ser operacion o estado-pago' });
    case 'METABASE_NO_CONFIGURADO':
      return new ServiceUnavailableException({ statusCode: 503, code, message: 'Los dashboards no están configurados' });
    case 'METABASE_NO_DISPONIBLE':
      return new ServiceUnavailableException({ statusCode: 503, code, message: 'El servidor de dashboards se está iniciando. Intenta nuevamente en un minuto' });
  }
};
