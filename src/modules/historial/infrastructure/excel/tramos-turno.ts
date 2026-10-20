import type { EstadoTurnoConciliacion, TurnoConciliacion } from '../../domain/repositories/historial.repository.port';

// Cómo se cuenta un tramo del turno, con los mismos grupos que la app del operador (verde, amarillo, rojo)
export type TipoTramo = 'EFECTIVO' | 'DEMORA' | 'MANTENCION' | 'SIN_ESTADO';

// Un tramo continuo del turno con un mismo estado operacional y una misma ubicación
export interface TramoTurno {
  inicio: Date;
  fin: Date;
  tipo: TipoTramo;
  estado: string | null; // nombre corto; null = sin estado registrado
  area: string | null;
  zona: string | null;
}

export type DesgloseTurno = Record<TipoTramo, number>; // horas

// Igual que la app (utils/desgloseHoras.ts): efectivo si el estado es productivo; si no, decide la categoría
const tipoDeEstado = (estado: EstadoTurnoConciliacion): TipoTramo =>
  estado.esProductivo ? 'EFECTIVO' : estado.categoria === 'MANTENCION' ? 'MANTENCION' : 'DEMORA';

// "Demora / Colación y Descanso" -> "Colación y Descanso"
const nombreCorto = (nombre: string) => nombre.split('/').slice(1).join('/').trim() || nombre.trim();

/**
 * Línea de tiempo de un turno cerrado: se corta en cada cambio de estado y de ubicación, de modo que
 * cada tramo tiene un solo estado y una sola área/zona y entre todos cubren el turno completo. El tiempo
 * sin estado registrado (p. ej. antes de elegir el primero) queda como SIN_ESTADO. Un turno en curso no
 * tiene tramos: sus horas aún no se pueden conciliar.
 */
export const tramosTurno = (turno: TurnoConciliacion): TramoTurno[] => {
  if (!turno.horaTermino) return [];
  const desde = turno.horaInicio.getTime();
  const hasta = turno.horaTermino.getTime();
  if (hasta <= desde) return [];

  const finEstado = (estado: EstadoTurnoConciliacion) => (estado.fin ? estado.fin.getTime() : hasta);
  const cortes = new Set([desde, hasta]);
  const agregarCorte = (momento: number) => {
    if (momento > desde && momento < hasta) cortes.add(momento);
  };
  for (const estado of turno.estados) {
    agregarCorte(estado.inicio.getTime());
    agregarCorte(finEstado(estado));
  }
  for (const ubicacion of turno.ubicaciones) agregarCorte(ubicacion.inicio.getTime());
  const puntos = [...cortes].sort((a, b) => a - b);

  const tramos: TramoTurno[] = [];
  let estadoPrevio: EstadoTurnoConciliacion | null = null;
  for (let i = 0; i < puntos.length - 1; i++) {
    const inicio = puntos[i];
    // El estado más reciente que ya empezó y sigue vigente; la última ubicación que ya empezó
    const estado = turno.estados.findLast((e) => e.inicio.getTime() <= inicio && finEstado(e) > inicio) ?? null;
    const ubicacion = turno.ubicaciones.findLast((u) => u.inicio.getTime() <= inicio) ?? turno.ubicaciones[0] ?? null;
    const tramo: TramoTurno = {
      inicio: new Date(inicio),
      fin: new Date(puntos[i + 1]),
      tipo: estado ? tipoDeEstado(estado) : 'SIN_ESTADO',
      estado: estado ? nombreCorto(estado.nombre) : null,
      area: ubicacion?.area ?? null,
      zona: ubicacion?.zona ?? null,
    };
    const previo = tramos[tramos.length - 1];
    if (previo && estado === estadoPrevio && previo.area === tramo.area && previo.zona === tramo.zona) {
      previo.fin = tramo.fin;
    } else {
      tramos.push(tramo);
    }
    estadoPrevio = estado;
  }
  return tramos;
};

export const horasTramo = (tramo: TramoTurno) => (tramo.fin.getTime() - tramo.inicio.getTime()) / 3600000;

// Horas del turno por grupo; suman la duración del turno
export const desgloseTurno = (tramos: TramoTurno[]): DesgloseTurno => {
  const desglose: DesgloseTurno = { EFECTIVO: 0, DEMORA: 0, MANTENCION: 0, SIN_ESTADO: 0 };
  for (const tramo of tramos) desglose[tramo.tipo] += horasTramo(tramo);
  return desglose;
};

// El tiempo que el turno pasó en una misma área/zona, con su propio desglose de horas
export interface TramoUbicacion {
  inicio: Date;
  fin: Date | null; // null = turno en curso en esta ubicación
  area: string | null;
  zona: string | null;
  tramos: TramoTurno[]; // estados dentro de esta ubicación (vacío si el turno sigue en curso)
}

/**
 * Divide el turno en las ubicaciones por las que pasó, en orden. Un cambio a la misma área y zona no abre
 * otro tramo. Un turno sin ubicación registrada queda como un solo tramo sin área.
 */
export const tramosPorUbicacion = (turno: TurnoConciliacion): TramoUbicacion[] => {
  const fin = turno.horaTermino;
  const ubicaciones = turno.ubicaciones.filter(
    (u, i, todas) => i === 0 || u.area !== todas[i - 1].area || u.zona !== todas[i - 1].zona,
  );
  const base = ubicaciones.length > 0 ? ubicaciones : [{ area: null, zona: null, inicio: turno.horaInicio }];
  const porUbicacion: TramoUbicacion[] = base.map((u, i) => ({
    // La primera parte con el turno, aunque la ubicación se haya guardado unos milisegundos después
    inicio: i === 0 ? turno.horaInicio : u.inicio,
    fin: base[i + 1]?.inicio ?? fin,
    area: u.area,
    zona: u.zona,
    tramos: [],
  }));
  for (const tramo of tramosTurno(turno)) {
    const destino = porUbicacion.findLast((u) => u.inicio.getTime() <= tramo.inicio.getTime()) ?? porUbicacion[0];
    destino.tramos.push(tramo);
  }
  // Un cambio informado en el mismo instante del cierre no tiene horas: no se muestra
  return porUbicacion.filter((u, i) => i === 0 || !u.fin || u.fin.getTime() > u.inicio.getTime());
};
