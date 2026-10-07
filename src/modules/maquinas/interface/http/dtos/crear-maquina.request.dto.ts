export class CrearMaquinaRequestDto {
  nombre: string;
  marca?: string;
  modelo?: string;
  anio?: number;
  tipoMaquina?: string;
  patente?: string;
  numeroChasis?: string;
  horometroInicial: number;
  esContratista?: boolean;
}
