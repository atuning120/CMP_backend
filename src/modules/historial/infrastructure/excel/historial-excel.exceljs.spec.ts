import { Workbook } from 'exceljs';
import type { EventoHistorial, TurnoConciliacion } from '../../domain/repositories/historial.repository.port';
import type { DatosExcelHistorial } from '../../domain/ports/historial-excel.port';
import { HistorialExcelExceljs } from './historial-excel.exceljs';

const equipo = { codigo: '3239', patente: 'TR659170488', numeroChasis: null, tipo: 'Cargador Frontal', esContratista: true };

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
    ubicaciones: [
      { area: 'Área 54 - Planta de Tratamiento Rechazos', zona: null },
      { area: 'Área 84 - Botadero de Estéril', zona: 'Botadero Norte' },
      { area: 'Área 84 - Botadero de Estéril', zona: 'Botadero Sur' },
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
    expect(libro.worksheets.map((h) => h.name)).toEqual(['Turnos', 'Resumen por equipo', 'Movimientos de flota']);

    const hoja = libro.getWorksheet('Turnos')!;
    expect(hoja.getCell('A2').value).toContain('01-10-2026 al 07-10-2026');
    // Mismo orden que el reporte de la contratista
    expect(hoja.getRow(5).values).toEqual(
      expect.arrayContaining(['Equipo', 'Categoría', 'Fecha', 'Hora inicio', 'Horómetro inicial', 'Horómetro final', 'Diferencia (hrs)', 'Área']),
    );

    const dia = hoja.getRow(6);
    expect(dia.getCell('B').value).toBe('3239');
    expect(dia.getCell('C').value).toBe('Cargador Frontal');
    expect(dia.getCell('D').value).toEqual(new Date(Date.UTC(2026, 9, 7)));
    expect(dia.getCell('E').value).toBe('Día');
    expect(dia.getCell('F').value).toEqual(new Date(Date.UTC(2026, 9, 7, 7, 25)));
    expect(dia.getCell('I').value).toEqual({ formula: 'H6-G6', result: 9 });
    expect(dia.getCell('J').value).toBe('Área 54 - Planta de Tratamiento Rechazos → Área 84 - Botadero de Estéril');
    expect(dia.getCell('K').value).toBe('Botadero Norte → Botadero Sur');
    expect(dia.getCell('L').value).toBe('TR659170488');
    expect(dia.getCell('P').value).toBe(10);
    expect(dia.getCell('R').value).toBeNull();

    const noche = hoja.getRow(7);
    expect(noche.getCell('E').value).toBe('Noche');
    expect(noche.getCell('I').value).toBeNull();
    expect(noche.getCell('R').value).toBe('Sí');
    expect(noche.getCell('S').value).toBe('Turno en curso');

    // Totales de las filas visibles sobre la tabla
    expect(hoja.getCell('I4').value).toEqual({ formula: 'SUBTOTAL(109,I6:I7)', result: 9 });

    const resumen = libro.getWorksheet('Resumen por equipo')!;
    const fila = resumen.getRow(6);
    expect(fila.getCell('A').value).toBe('3239');
    expect(fila.getCell('E').value).toBe(2);
    expect(fila.getCell('F').value).toBe(9);
    expect(fila.getCell('H').value).toBe(1);
    expect(resumen.getCell('J6').value).toMatchObject({ formula: 'IF(I6="","",I6-F6)' });
    expect(resumen.getCell('A7').value).toBe('Total');

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
    expect(soloTurnos.worksheets.map((h) => h.name)).toEqual(['Turnos', 'Resumen por equipo']);
    const soloFlota = await leer(await generador.generar({ turnos: [], movimientos }, datos('FLOTA')));
    expect(soloFlota.worksheets.map((h) => h.name)).toEqual(['Movimientos de flota']);
  });
});
