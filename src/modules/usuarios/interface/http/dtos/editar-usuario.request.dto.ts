export class EditarUsuarioRequestDto {
  email: string;
  nombre: string;
  apellido?: string;
  rut?: string;
  telefono?: string;
  accesoMicrosoft?: boolean;
  password?: string;
}
