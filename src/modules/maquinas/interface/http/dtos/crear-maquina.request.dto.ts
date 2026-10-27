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
  idCliente?: string; // UUID generado por el cliente: un reintento devuelve la misma máquina en vez de duplicarla
  valoresBase?: { maquinaOperador?: number | null }; // la máquina en que vio al operador que asigna
}
