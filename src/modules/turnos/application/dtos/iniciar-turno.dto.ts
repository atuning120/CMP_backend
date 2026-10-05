export class IniciarTurnoDto {
  idOperador: number;
  idMaquina: number;
  horometroInicial: number;
  idArea: number;
  idZona: number | null;
  // Datos de la app offline-first: UUID de la operación y momento real del inicio
  idCliente?: string | null;
  fechaInicio?: string | Date | null;
}
