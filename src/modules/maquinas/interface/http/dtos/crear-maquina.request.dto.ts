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
  idOperador?: number | null; // opcional: operador a cargo
  motivo: string;
  observacion?: string;
}
