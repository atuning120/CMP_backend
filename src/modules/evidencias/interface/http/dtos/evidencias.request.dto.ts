import { IsOptional, IsString } from 'class-validator';

// Solo se decoran los textos que llegan a métodos de string (validarIdCliente, .trim()): un número o arreglo daría 500.
// tipo no: un valor que no es texto ya responde TIPO_REPORTE_INVALIDO. idTurno lo convierte el controller con Number()
export class CrearReporteRequestDto {
  @IsOptional()
  @IsString()
  idCliente: string;
  idTurno?: number;
  @IsOptional()
  @IsString()
  idClienteTurno?: string;
  tipo: string;
  @IsOptional()
  @IsString()
  descripcion?: string;
  fechaHora?: string;
}

// multipart/form-data: los campos siempre llegan como texto, salvo un campo repetido, que multer entrega como arreglo
export class SubirEvidenciaRequestDto {
  @IsOptional()
  @IsString()
  idCliente: string;
  @IsOptional()
  @IsString()
  idClienteReporte: string;
  fechaHora?: string;
}
