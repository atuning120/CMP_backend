import { Workbook } from 'exceljs';
import type { EventoHistorial, TurnoConciliacion } from '../../domain/repositories/historial.repository.port';
import type { DatosExcelHistorial } from '../../domain/ports/historial-excel.port';
import { HistorialExcelExceljs } from './historial-excel.exceljs';

const equipo = { codigo: '3239', patente: 'TR659170488', numeroChasis: null, tipo: 'Cargador Frontal', esContratista: true };

const carguio = { nombre: 'Efectivo / Carguío y Excavación', categoria: 'PRODUCTIVO' as const, esProductivo: true };
const colacion = { nombre: 'Demora / Colación y Descanso', categoria: 'DEMORA' as const, esProductivo: false };
const falla = { nombre: 'Mantención / Falla de Sistema Hidráulico', categoria: 'MANTENCION' as const, esProductivo: false };

const turnos: TurnoConciliacion[] = [
  {
    idTurno: 1,
    // 07:25 en Chile (UTC-3)
    horaInicio: new Date('2026-10-07T10:25:00.000Z'),
    horaTermino: new Date('2026-10-07T20:25:00.000Z'),
    estado: 'CERRADO',
    horometroInicial: 8372.8,
    horometroFinal: 8381.8,
    equipo,
    operador: 'María López',
    // Lo reasignan al botadero a las 11:00 y cambia de zona a las 14:00 (hora de Chile)
    ubicaciones: [
      { area: 'Área 54 - Planta de Tratamiento Rechazos', zona: null, inicio: new Date('2026-10-07T10:25:00.000Z') },
      { area: 'Área 84 - Botadero de Estéril', zona: 'Botadero Norte', inicio: new Date('2026-10-07T14:00:00.000Z') },
      { area: 'Área 84 - Botadero de Estéril', zona: 'Botadero Sur', inicio: new Date('2026-10-07T17:00:00.000Z') },
    ],
    // 15 min sin estado, carguío, colación, carguío y una falla hasta el cierre
    estados: [
      { ...carguio, inicio: new Date('2026-10-07T10:40:00.000Z'), fin: new Date('2026-10-07T14:00:00.000Z') },
      { ...colacion, inicio: new Date('2026-10-07T14:00:00.000Z'), fin: new Date('2026-10-07T15:00:00.000Z') },
      { ...carguio, inicio: new Date('2026-10-07T15:00:00.000Z'), fin: new Date('2026-10-07T19:00:00.000Z') },
      { ...falla, inicio: new Date('2026-10-07T19:00:00.000Z'), fin: new Date('2026-10-07T20:25:00.000Z') },
    ],
    conflicto: null,
    cerradoPor: null,
    motivoCierre: null,
  },
  {
    idTurno: 2,
    // 18:30 en Chile: turno de noche, todavía abierto
    horaInicio: new Date('2026-10-07T21:30:00.000Z'),
    horaTermino: null,
    estado: 'EN_CURSO',
    horometroInicial: 8381.8,
    horometroFinal: null,
    equipo,
    operador: 'Juan Pérez',
    ubicaciones: [],
    estados: [{ ...carguio, inicio: new Date('2026-10-07T21:30:00.000Z'), fin: null }],
    conflicto: null,
    cerradoPor: null,
    motivoCierre: null,
  },
];

const movimientos: EventoHistorial[] = [
  {
    id: 'B-2',
    tipo: 'CAMBIAR_ESTADO',
    fecha: new Date('2026-10-07T15:30:00.000Z'),
    actor: 'Pedro Soto',
    maquina: { id: 1, nombre: '3239' },
    motivo: 'Falla hidráulica',
    observacion: null,
    detalle: { antes: { estado: 'ACTIVA' }, despues: { estado: 'EN_MANTENIMIENTO', regresoEstimado: '2026-10-10T03:00:00.000Z' } },
  },
];

const datos = (tipo: DatosExcelHistorial['tipo']): DatosExcelHistorial => ({
  tipo,
  desde: new Date('2026-10-01T03:00:00.000Z'),
  hasta: new Date('2026-10-08T03:00:00.000Z'),
  generado: new Date('2026-10-08T12:00:00.000Z'),
  zonaHoraria: 'America/Santiago',
});

const leer = async (contenido: Buffer) => {
  const libro = new Workbook();
  // Los tipos de ExcelJS esperan el Buffer de @types/node anterior
  await libro.xlsx.load(contenido as unknown as Parameters<typeof libro.xlsx.load>[0]);
  return libro;
};

describe('HistorialExcelExceljs', () => {
  it('TODO arma turnos, resumen por equipo y movimientos de flota', async () => {
    const libro = await leer(await new HistorialExcelExceljs().generar({ turnos, movimientos }, datos('TODO')));
    expect(libro.worksheets.map((h) => h.name)).toEqual(['Turnos', 'Resumen por equipo', 'Estados operacionales', 'Movimientos de flota']);

    const hoja = libro.getWorksheet('Turnos')!;
    expect(hoja.getCell('A2').value).toContain('01-10-2026 al 07-10-2026');
    // Mismo orden que el reporte de la contratista
    expect(hoja.getRow(5).values).toEqual(
      expect.arrayContaining(['Equipo', 'Categoría', 'Fecha', 'Hora inicio', 'Horómetro inicial', 'Horómetro final', 'Diferencia (hrs)', 'Área']),
    );

    // El turno de día pasó por 3 ubicaciones: una fila por cada una, con su propio desglose de horas
    const dia = hoja.getRow(6);
    expect(dia.getCell('A').value).toBe(1);
    expect(dia.getCell('B').value).toBe('3239');
    expect(dia.getCell('C').value).toBe('Cargador Frontal');
    expect(dia.getCell('D').value).toEqual(new Date(Date.UTC(2026, 9, 7)));
    expect(dia.getCell('E').value).toBe('Día');
    expect(dia.getCell('F').value).toEqual(new Date(Date.UTC(2026, 9, 7, 7, 25)));
    expect(dia.getCell('I').value).toEqual({ formula: 'H6-G6', result: 9 });
    expect(dia.getCell('J').value).toBe('Área 54 - Planta de Tratamiento Rechazos');
    expect(dia.getCell('K').value).toBeNull();
    expect(dia.getCell('L').value).toBe('TR659170488');
    // 07:25 a 11:00: hasta que lo reasignaron al botadero
    expect(dia.getCell('O').value).toEqual(new Date(Date.UTC(2026, 9, 7, 11, 0)));
    expect(dia.getCell('P').value).toBe(3.58);
    // Horas por grupo de estado, como en la app: efectivas, demoras, mantención y sin estado suman la duración
    expect(hoja.getCell('Q5').value).toBe('Horas efectivas');
    expect(hoja.getCell('Q5').fill).toMatchObject({ fgColor: { argb: 'FF1E8E3E' } });
    expect(hoja.getCell('R5').fill).toMatchObject({ fgColor: { argb: 'FFF9AB00' } });
    expect(hoja.getCell('S5').fill).toMatchObject({ fgColor: { argb: 'FFD93025' } });
    expect([dia.getCell('Q').value, dia.getCell('R').value, dia.getCell('S').value, dia.getCell('T').value]).toEqual([3.33, 0, 0, 0.25]);
    expect(dia.getCell('V').value).toBeNull();

    // Las filas siguientes del mismo turno: sin horómetro (se lee al inicio y al cierre del turno)
    const norte = hoja.getRow(7);
    expect(norte.getCell('A').value).toBe(1);
    expect(norte.getCell('F').value).toEqual(new Date(Date.UTC(2026, 9, 7, 11, 0)));
    expect([norte.getCell('G').value, norte.getCell('H').value, norte.getCell('I').value]).toEqual([null, null, null]);
    expect([norte.getCell('J').value, norte.getCell('K').value]).toEqual(['Área 84 - Botadero de Estéril', 'Botadero Norte']);
    expect([norte.getCell('P').value, norte.getCell('Q').value, norte.getCell('R').value, norte.getCell('S').value]).toEqual([3, 2, 1, 0]);
    const sur = hoja.getRow(8);
    expect([sur.getCell('K').value, sur.getCell('P').value, sur.getCell('Q').value, sur.getCell('S').value]).toEqual(['Botadero Sur', 3.42, 2, 1.42]);
    expect(sur.getCell('O').value).toEqual(new Date(Date.UTC(2026, 9, 7, 17, 25)));

    const noche = hoja.getRow(9);
    expect(noche.getCell('E').value).toBe('Noche');
    expect(noche.getCell('I').value).toBeNull();
    // En curso: sus horas aún no se concilian
    expect(noche.getCell('Q').value).toBeNull();
    expect(noche.getCell('V').value).toBe('Sí');
    expect(noche.getCell('W').value).toBe('Turno en curso');

    // Totales de las filas visibles sobre la tabla
    expect(hoja.getCell('I4').value).toEqual({ formula: 'SUBTOTAL(109,I6:I9)', result: 9 });
    expect(hoja.getCell('P4').value).toEqual({ formula: 'SUBTOTAL(109,P6:P9)', result: 10 });
    expect(hoja.getCell('Q4').value).toEqual({ formula: 'SUBTOTAL(109,Q6:Q9)', result: 7.33 });

    const resumen = libro.getWorksheet('Resumen por equipo')!;
    const fila = resumen.getRow(6);
    expect(fila.getCell('A').value).toBe('3239');
    expect(fila.getCell('E').value).toBe(2);
    expect(fila.getCell('F').value).toBe(9);
    expect([fila.getCell('H').value, fila.getCell('I').value, fila.getCell('J').value, fila.getCell('K').value]).toEqual([7.33, 1, 1.42, 0.25]);
    expect(fila.getCell('L').value).toBe(1);
    expect(resumen.getCell('N6').value).toMatchObject({ formula: 'IF(M6="","",M6-F6)' });
    expect(resumen.getCell('A7').value).toBe('Total');

    // Un tramo por estado y ubicación del turno cerrado; el turno en curso no aparece
    const estados = libro.getWorksheet('Estados operacionales')!;
    const tramos = [6, 7, 8, 9, 10, 11].map((n) => {
      const r = estados.getRow(n);
      return [r.getCell('A').value, r.getCell('G').value, r.getCell('H').value, r.getCell('I').value, r.getCell('J').value, r.getCell('K').value];
    });
    expect(tramos).toEqual([
      [1, 0.25, 'Sin estado registrado', null, 'Área 54 - Planta de Tratamiento Rechazos', null],
      [1, 3.33, 'Horas efectivas', 'Carguío y Excavación', 'Área 54 - Planta de Tratamiento Rechazos', null],
      [1, 1, 'Demoras operacionales', 'Colación y Descanso', 'Área 84 - Botadero de Estéril', 'Botadero Norte'],
      [1, 2, 'Horas efectivas', 'Carguío y Excavación', 'Área 84 - Botadero de Estéril', 'Botadero Norte'],
      [1, 2, 'Horas efectivas', 'Carguío y Excavación', 'Área 84 - Botadero de Estéril', 'Botadero Sur'],
      [1, 1.42, 'Mantención y fallas', 'Falla de Sistema Hidráulico', 'Área 84 - Botadero de Estéril', 'Botadero Sur'],
    ]);
    expect(estados.getRow(12).getCell('A').value).toBeNull();
    // La colación parte a las 14:00 UTC, las 11:00 en Chile
    expect(estados.getCell('E8').value).toEqual(new Date(Date.UTC(2026, 9, 7, 11, 0)));
    expect(estados.getCell('H8').fill).toMatchObject({ fgColor: { argb: 'FFFEF7E0' } });
    expect(estados.getCell('G4').value).toEqual({ formula: 'SUBTOTAL(109,G6:G11)', result: 10 });

    const flota = libro.getWorksheet('Movimientos de flota')!.getRow(6);
    // 15:30 UTC son las 12:30 en Chile
    expect(flota.getCell('A').value).toEqual(new Date(Date.UTC(2026, 9, 7, 12, 30)));
    expect(flota.getCell('C').value).toBe('Cambio de estado');
    expect(flota.getCell('E').value).toBe('Cambió el estado de 3239 · regreso estimado 10-10-2026');
    expect(flota.getCell('F').value).toBe('Operativa');
    expect(flota.getCell('G').value).toBe('En mantenimiento');
  });

  it('cada tipo lleva solo sus hojas', async () => {
    const generador = new HistorialExcelExceljs();
    const soloTurnos = await leer(await generador.generar({ turnos, movimientos: [] }, datos('TURNOS')));
    expect(soloTurnos.worksheets.map((h) => h.name)).toEqual(['Turnos', 'Resumen por equipo', 'Estados operacionales']);
    const soloFlota = await leer(await generador.generar({ turnos: [], movimientos }, datos('FLOTA')));
    expect(soloFlota.worksheets.map((h) => h.name)).toEqual(['Movimientos de flota']);
  });
});
