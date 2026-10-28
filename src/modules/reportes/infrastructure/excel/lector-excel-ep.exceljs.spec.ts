import { Workbook } from 'exceljs';
import { LectorExcelEpExceljs } from './lector-excel-ep.exceljs';

// Igual que el EP real: hojas con datos personales antes de "Base de datos", códigos de equipo numéricos y de texto,
// fechas como Date o como número serial, horas como fracción del día y una fila de totales al final
const libroEp = async () => {
  const libro = new Workbook();
  libro.addWorksheet('R.HORAS').addRow(['N°', 'SAP', 'NOMBRE']).worksheet.addRow([1, 20012345, 'Persona de Prueba']);
  const hoja = libro.addWorksheet('Base de datos ');
  hoja.addRow(['ID', 'Equipo', 'Categoria ', 'Codigo Report', 'Fecha', 'Hora Inicio', 'Horometro Inicial', 'Horometro Final', 'Diferencia', 'Area', 'Actividad']);
  hoja.addRow([1, 3239, 'Cargador Frontal', 320001, new Date(Date.UTC(2026, 4, 25)), 0.1695, 28000, 28009, 9, 'MLC', 'Area 55']);
  hoja.addRow([2, 'MA51525541', 'Bulldozer', 320002, 46170, new Date(Date.UTC(1899, 11, 30, 19, 30)), 241.5, 248, 6.5, 'MLC', 'Tacho']);
  hoja.addRow([3, null, 'Bulldozer', 320003, 46171, 0.5, 248, 250, 2, 'MLC', 'Area 84']); // sin equipo
  hoja.addRow([4, 2108, 'Excavadora', 320004, 'no es fecha', 0.5, 1, 2, 1, 'MLC', 'Area 84']);
  hoja.addRow([5, 2108, 'Excavadora', 320005, '26-05-2026', '08:15', null, null, 30, 'MLC', 'Area 84']); // más de 24 h
  hoja.addRow([6, 6406, 'Bulldozer', 320006, '27/05/2026', '20:00', '100,5', '108,5', { formula: 'H7-G7', result: 8 }, 'MLC', null]);
  hoja.addRow([]);
  hoja.addRow([null, null, null, null, null, null, null, null, { formula: 'SUM(I2:I7)', result: 56.5 }]); // totales
  return Buffer.from(await libro.xlsx.writeBuffer());
};

describe('LectorExcelEpExceljs', () => {
  const lector = new LectorExcelEpExceljs();

  it('lee solo la hoja "Base de datos" y normaliza códigos, fechas y horas', async () => {
    const lectura = await lector.leer(await libroEp());
    expect(lectura?.registros).toEqual([
      {
        fila: 2,
        equipo: '3239',
        categoria: 'Cargador Frontal',
        codigoReport: '320001',
        fecha: '2026-05-25',
        horaInicio: '04:04:05',
        horometroInicial: 28000,
        horometroFinal: 28009,
        horas: 9,
        actividad: 'Area 55',
      },
      expect.objectContaining({ fila: 3, equipo: 'MA51525541', fecha: '2026-05-28', horaInicio: '19:30:00', horas: 6.5, actividad: 'Tacho' }),
      expect.objectContaining({
        fila: 7,
        equipo: '6406',
        fecha: '2026-05-27',
        horaInicio: '20:00:00',
        horometroInicial: 100.5,
        horometroFinal: 108.5,
        horas: 8,
        actividad: null,
      }),
    ]);
    // La fila vacía y la de totales se ignoran sin error
    expect(lectura?.errores).toEqual([
      { fila: 4, mensaje: 'Falta el equipo' },
      { fila: 5, mensaje: 'La fecha no es válida' },
      { fila: 6, mensaje: 'Las horas deben estar entre 0 y 24' },
    ]);
  });

  it('avisa si falta la hoja o sus columnas obligatorias', async () => {
    const sinHoja = new Workbook();
    sinHoja.addWorksheet('Carátula EP').addRow(['CONTRATO']);
    expect(await lector.leer(Buffer.from(await sinHoja.xlsx.writeBuffer()))).toEqual({
      registros: [],
      errores: [{ fila: null, mensaje: 'No se encontró la hoja "Base de datos"' }],
    });

    const sinColumnas = new Workbook();
    sinColumnas.addWorksheet('Base de datos').addRow(['Equipo', 'Fecha']);
    expect((await lector.leer(Buffer.from(await sinColumnas.xlsx.writeBuffer())))?.errores[0].mensaje).toContain('Diferencia');
  });

  it('devuelve null si el contenido no es un .xlsx', async () => {
    expect(await lector.leer(Buffer.from('PK\x03\x04 no es un zip de verdad'))).toBeNull();
  });
});
