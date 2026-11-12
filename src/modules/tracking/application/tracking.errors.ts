import { BadRequestException, NotFoundException } from '@nestjs/common';

// Errores de tracking: código estable más un mensaje legible (los lee el adaptador en su log y el panel web)
export type TrackingErrorCode = 'LOTE_INVALIDO' | 'RANGO_INVALIDO' | 'TURNO_NO_ENCONTRADO';

export const trackingError = (code: TrackingErrorCode, detalle?: string) => {
  switch (code) {
    case 'LOTE_INVALIDO':
      return new BadRequestException({
        statusCode: 400,
        code,
        message: 'Se esperaba { posiciones: [...] } con entre 1 y 500 posiciones',
      });
    case 'RANGO_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: detalle ?? 'Rango de fechas inválido' });
    case 'TURNO_NO_ENCONTRADO':
      return new NotFoundException({ statusCode: 404, code, message: 'Turno no encontrado' });
  }
};
