// Posición tal como la manda el adaptador: viene de un dispositivo GT06 (LL301 o la app móvil haciéndose pasar por uno)
export interface PosicionDispositivo {
  imei: string;
  fechaHora: Date;
  latitud: number;
  longitud: number;
  velocidad: number | null; // km/h
  rumbo: number | null; // grados desde el norte
  bateria: number | null; // porcentaje
  satelites: number | null;
  enTiempoReal: boolean; // false: guardada sin señal y reenviada después
  tramaHex: string | null;
}

// Posición ya asociada a la máquina en la que estaba instalado el dispositivo en ese momento
export interface PosicionMaquina {
  idMaquina: number;
  fechaHora: Date;
  latitud: number;
  longitud: number;
  velocidad: number | null;
  rumbo: number | null;
  bateria: number | null;
}
