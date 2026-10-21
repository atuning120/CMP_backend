import { BadRequestException } from '@nestjs/common';

// Errores de tracking: código estable más un mensaje legible (los lee el adaptador en su log)
export type TrackingErrorCode = 'LOTE_INVALIDO';

export const trackingError = (code: TrackingErrorCode) => {
  switch (code) {
    case 'LOTE_INVALIDO':
      return new BadRequestException({
        statusCode: 400,
        code,
        message: 'Se esperaba { posiciones: [...] } con entre 1 y 500 posiciones',
      });
  }
};
