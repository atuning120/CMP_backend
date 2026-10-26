// Campos tal como llegan del cliente; se validan en el caso de uso
export interface CrearUsuarioDto {
  datos: {
    nombre?: unknown;
    apellido?: unknown;
    email?: unknown;
    rol?: unknown;
    accesoMicrosoft?: unknown; // true: entra solo con Microsoft, sin contraseña (no para OPERADOR)
    password?: unknown; // obligatoria si no entra con Microsoft
    rut?: unknown; // solo OPERADOR
    telefono?: unknown; // solo OPERADOR, opcional
  };
  autor: { idUsuario: number; rol: string };
}
