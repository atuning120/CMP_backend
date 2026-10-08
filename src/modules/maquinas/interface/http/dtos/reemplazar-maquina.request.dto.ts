import type { CrearMaquinaRequestDto } from './crear-maquina.request.dto';

// La entrante es una de la flota (idMaquinaEntrante) o una nueva (maquinaNueva), nunca ambas
export class ReemplazarMaquinaRequestDto {
  idMaquinaEntrante?: number;
  maquinaNueva?: Omit<CrearMaquinaRequestDto, 'motivo' | 'observacion' | 'idOperador'>;
  idOperador?: number | null; // ausente: el operador de la saliente pasa a la entrante
  motivo: string;
  observacion?: string | null;
}
