export class CrearUsuarioRequestDto {
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  accesoMicrosoft?: boolean;
  password?: string;
  rut?: string;
  telefono?: string;
}
