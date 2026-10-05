export class IniciarTurnoRequestDto {
  idMaquina: number;
  horometroInicial: number;
  idArea: number;
  idZona?: number | null;
  // App offline-first: UUID de la operación (idempotencia) y momento real del inicio (ISO 8601)
  idCliente?: string;
  fechaInicio?: string;
}
