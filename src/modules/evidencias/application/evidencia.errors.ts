import { BadRequestException, NotFoundException } from '@nestjs/common';

export type EvidenciaErrorCode = 'TIPO_REPORTE_INVALIDO' | 'REPORTE_NO_ENCONTRADO' | 'ARCHIVO_INVALIDO' | 'EVIDENCIA_NO_ENCONTRADA';

export const evidenciaError = (code: EvidenciaErrorCode) => {
  switch (code) {
    case 'TIPO_REPORTE_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'El tipo de reporte debe ser INICIO, FIN o NOVEDAD' });
    case 'REPORTE_NO_ENCONTRADO':
      return new NotFoundException({ statusCode: 404, code, message: 'Reporte no encontrado' });
    case 'ARCHIVO_INVALIDO':
      return new BadRequestException({ statusCode: 400, code, message: 'La evidencia debe ser una imagen JPEG, PNG, WEBP o HEIC de hasta 10 MB' });
    case 'EVIDENCIA_NO_ENCONTRADA':
      return new NotFoundException({ statusCode: 404, code, message: 'Evidencia no encontrada' });
  }
};
