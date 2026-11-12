import { IsOptional, IsString } from 'class-validator';

// Solo se decoran los textos que llegan a métodos de string (validarIdCliente): un número o arreglo daría 500.
// Los números no: el controller los convierte con Number() (la app puede mandarlos como texto) y el use case
// responde su propio código si no sirven. Las fechas tampoco: new Date() de un valor inválido ya da FECHA_INVALIDA
export class IniciarTurnoRequestDto {
  idMaquina: number;
  horometroInicial: number;
  idArea: number;
  idZona?: number | null;
  // App offline-first: UUID de la operación (idempotencia) y momento real del inicio (ISO 8601)
  @IsOptional()
  @IsString()
  idCliente?: string;
  fechaInicio?: string;
}
