// Campos tal como llegan del cliente; se validan en el caso de uso
export interface EditarUsuarioDto {
  idUsuario: number;
  datos: {
    email?: unknown;
    nombre?: unknown; // usuario web: nombre completo. Operador: nombre de su ficha
    apellido?: unknown; // solo operador
    rut?: unknown; // solo operador
    telefono?: unknown; // solo operador, opcional
    accesoMicrosoft?: unknown; // true: entra solo con Microsoft (se quita la contraseña)
    password?: unknown; // nueva contraseña; vacía = se mantiene la actual
  };
  autor: { idUsuario: number; rol: string };
}
