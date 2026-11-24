import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

// Solo el tipo de cada campo (ValidacionTiposPipe); las reglas las decide cada use case con su código de error

export class RegistrarGpsRequestDto {
  @IsOptional()
  @IsString()
  imei?: string;

  @IsOptional()
  @IsString()
  modelo?: string | null;

  @IsOptional()
  @IsString()
  numeroSim?: string | null;
}

export class EditarGpsRequestDto {
  @IsOptional()
  @IsString()
  modelo?: string | null;

  @IsOptional()
  @IsString()
  numeroSim?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class DesvincularGpsRequestDto {
  // Máquina en que el usuario vio el GPS; si ya no está ahí, responde 409 GPS_MODIFICADO
  @IsOptional()
  @IsInt()
  idMaquinaActual?: number | null;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @IsString()
  observacion?: string | null;
}

export class AsignarGpsRequestDto extends DesvincularGpsRequestDto {
  @IsOptional()
  @IsInt()
  idMaquina?: number;

  // GPS que hoy tiene la máquina de destino y que el usuario acepta sacar (null: no tiene)
  @IsOptional()
  @IsInt()
  idGpsDesplazado?: number | null;
}
