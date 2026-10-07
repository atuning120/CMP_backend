export const MODELO_MAQUINA_REPOSITORY = Symbol('MODELO_MAQUINA_REPOSITORY');

// Plantilla genérica de un modelo de máquina ("Datos Previos" al incorporar una máquina)
export interface ModeloMaquina {
  idModelo: number;
  nombre: string;
  marca: string;
  modelo: string;
  tipoMaquina: string;
}

export interface ModeloMaquinaRepositoryPort {
  findActivos(): Promise<ModeloMaquina[]>;
  // No hace nada si ya existe un modelo con la misma marca y modelo (índice único)
  crearSiNoExiste(datos: Omit<ModeloMaquina, 'idModelo'>): Promise<void>;
}
