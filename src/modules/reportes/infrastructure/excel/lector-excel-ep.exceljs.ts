import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import type { CellValue, Row, Worksheet } from 'exceljs';
import type { RegistroEp } from '../../domain/repositories/carga-ep.repository.port';
import type { ErrorFilaEp, LecturaExcelEp, LectorExcelEpPort } from '../../domain/ports/lector-excel-ep.port';

const HOJA = 'base de datos';
const FILAS_PARA_BUSCAR_ENCABEZADO = 10;
const MAXIMO_HORAS_REGISTRO = 24;
const DIA_MS = 24 * 60 * 60 * 1000;
const EPOCA_EXCEL = Date.UTC(1899, 11, 30); // día 0 de las fechas seriales de Excel

type Campo = 'equipo' | 'categoria' | 'codigoReport' | 'fecha' | 'horaInicio' | 'horometroInicial' | 'horometroFinal' | 'horas' | 'actividad';

// Encabezados aceptados (sin tildes, en minúsculas) para cada campo
const ENCABEZADOS: Record<Campo, string[]> = {
  equipo: ['equipo'],
  categoria: ['categoria'],
  codigoReport: ['codigo report', 'codigo reporte'],
  fecha: ['fecha'],
  horaInicio: ['hora inicio'],
  horometroInicial: ['horometro inicial'],
  horometroFinal: ['horometro final'],
  horas: ['diferencia', 'horas'],
  actividad: ['actividad'],
};
const OBLIGATORIOS: Campo[] = ['equipo', 'fecha', 'horas'];

const LARGO_MAXIMO: Partial<Record<Campo, number>> = { equipo: 50, categoria: 50, codigoReport: 30, actividad: 100 };

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Valor que muestra la celda: el resultado si es fórmula, el texto si es texto enriquecido o hipervínculo
const valorDe = (valor: CellValue): string | number | boolean | Date | null => {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date || typeof valor !== 'object') return valor as string | number | boolean | Date;
  if ('result' in valor) return valorDe(valor.result as CellValue);
  if ('richText' in valor) return valor.richText.map((parte) => parte.text).join('');
  if ('text' in valor) return String(valor.text);
  return null; // error de fórmula (#N/A, #REF!...)
};

const texto = (valor: ReturnType<typeof valorDe>): string | null => {
  if (valor === null) return null;
  if (typeof valor === 'number') return String(valor); // el código 3239 llega como número
  if (valor instanceof Date) return valor.toISOString();
  const t = String(valor).trim();
  return t || null;
};

const numero = (valor: ReturnType<typeof valorDe>): number | null | undefined => {
  if (valor === null) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
  if (typeof valor === 'string') {
    const t = valor.trim().replace(',', '.');
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined; // undefined = hay algo, pero no es un número
};

const dosDigitos = (n: number) => String(n).padStart(2, '0');

// Excel guarda fechas como números de días (serial) o, con formato de fecha, exceljs las entrega como Date en UTC
const fecha = (valor: ReturnType<typeof valorDe>): string | null => {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString().slice(0, 10);
  if (typeof valor === 'number' && valor > 20000 && valor < 80000) {
    return new Date(EPOCA_EXCEL + Math.floor(valor) * DIA_MS).toISOString().slice(0, 10);
  }
  if (typeof valor === 'string') {
    const t = valor.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    const local = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(t);
    const partes = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : null;
    if (!partes) return null;
    const candidata = `${partes[0]}-${dosDigitos(Number(partes[1]))}-${dosDigitos(Number(partes[2]))}`;
    const ms = Date.parse(`${candidata}T00:00:00Z`);
    return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === candidata ? candidata : null;
  }
  return null;
};

const horaDeSegundos = (segundos: number) => {
  const s = Math.round(segundos) % 86400;
  return `${dosDigitos(Math.floor(s / 3600))}:${dosDigitos(Math.floor((s % 3600) / 60))}:${dosDigitos(s % 60)}`;
};

// Hora como fracción del día (0,1695 = 04:04), como Date de exceljs (1899-12-30T04:04Z) o como texto HH:MM
const hora = (valor: ReturnType<typeof valorDe>): string | null | undefined => {
  if (valor === null) return null;
  if (valor instanceof Date) return horaDeSegundos((valor.getTime() - Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate())) / 1000);
  if (typeof valor === 'number' && valor >= 0) return horaDeSegundos((valor % 1) * 86400);
  if (typeof valor === 'string') {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(valor.trim());
    if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return `${dosDigitos(Number(m[1]))}:${m[2]}:${m[3] ?? '00'}`;
  }
  return undefined;
};

const buscarEncabezado = (hoja: Worksheet): { fila: number; columnas: Partial<Record<Campo, number>> } | null => {
  for (let n = 1; n <= Math.min(FILAS_PARA_BUSCAR_ENCABEZADO, hoja.rowCount); n++) {
    const columnas: Partial<Record<Campo, number>> = {};
    hoja.getRow(n).eachCell((celda, columna) => {
      const t = texto(valorDe(celda.value));
      if (!t) return;
      const encabezado = normalizar(t);
      for (const campo of Object.keys(ENCABEZADOS) as Campo[]) {
        if (columnas[campo] === undefined && ENCABEZADOS[campo].includes(encabezado)) columnas[campo] = columna;
      }
    });
    if (OBLIGATORIOS.every((campo) => columnas[campo] !== undefined)) return { fila: n, columnas };
  }
  return null;
};

const leerFila = (fila: Row, columnas: Partial<Record<Campo, number>>): { registro?: RegistroEp; error?: string; vacia?: boolean } => {
  const valor = (campo: Campo) => (columnas[campo] ? valorDe(fila.getCell(columnas[campo]).value) : null);

  const equipo = texto(valor('equipo'));
  const valorFecha = valor('fecha');
  // Filas en blanco y la de totales al final de la hoja (solo trae la suma de "Diferencia")
  if (!equipo && valorFecha === null) return { vacia: true };

  if (!equipo) return { error: 'Falta el equipo' };
  const dia = fecha(valorFecha);
  if (!dia) return { error: 'La fecha no es válida' };
  const horas = numero(valor('horas'));
  if (horas === null || horas === undefined) return { error: 'Falta la diferencia (horas) o no es un número' };
  if (horas < 0 || horas > MAXIMO_HORAS_REGISTRO) return { error: `Las horas deben estar entre 0 y ${MAXIMO_HORAS_REGISTRO}` };
  const horometroInicial = numero(valor('horometroInicial'));
  const horometroFinal = numero(valor('horometroFinal'));
  if (horometroInicial === undefined || horometroFinal === undefined) return { error: 'El horómetro no es un número' };
  const horaInicio = hora(valor('horaInicio'));
  if (horaInicio === undefined) return { error: 'La hora de inicio no es válida' };

  const campos = { equipo, categoria: texto(valor('categoria')), codigoReport: texto(valor('codigoReport')), actividad: texto(valor('actividad')) };
  for (const [campo, t] of Object.entries(campos)) {
    const maximo = LARGO_MAXIMO[campo as Campo];
    if (t && maximo && t.length > maximo) return { error: `El campo ${campo} supera los ${maximo} caracteres` };
  }

  return {
    registro: {
      fila: fila.number,
      ...campos,
      fecha: dia,
      horaInicio,
      horometroInicial,
      horometroFinal,
      horas: Math.round(horas * 100) / 100,
    },
  };
};

@Injectable()
export class LectorExcelEpExceljs implements LectorExcelEpPort {
  async leer(contenido: Buffer): Promise<LecturaExcelEp | null> {
    const libro = new Workbook();
    try {
      await libro.xlsx.load(contenido as unknown as ArrayBuffer);
    } catch {
      return null;
    }

    const hoja = libro.worksheets.find((h) => normalizar(h.name) === HOJA);
    if (!hoja) return { registros: [], errores: [{ fila: null, mensaje: 'No se encontró la hoja "Base de datos"' }] };
    const encabezado = buscarEncabezado(hoja);
    if (!encabezado) {
      return {
        registros: [],
        errores: [{ fila: null, mensaje: 'La hoja "Base de datos" debe tener las columnas Equipo, Fecha y Diferencia' }],
      };
    }

    const registros: RegistroEp[] = [];
    const errores: ErrorFilaEp[] = [];
    for (let n = encabezado.fila + 1; n <= hoja.rowCount; n++) {
      const resultado = leerFila(hoja.getRow(n), encabezado.columnas);
      if (resultado.registro) registros.push(resultado.registro);
      else if (resultado.error) errores.push({ fila: n, mensaje: resultado.error });
    }
    return { registros, errores };
  }
}
