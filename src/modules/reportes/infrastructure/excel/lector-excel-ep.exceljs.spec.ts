import { Workbook } from 'exceljs';
import { LectorExcelEpExceljs } from './lector-excel-ep.exceljs';

// Hoja "EP #08 MLC" como la del EP real: encabezado en la fila 9 (con celdas combinadas arriba), las dos tablas de
// tarifas con su título, otro bloque a la derecha (H a L) que no se lee, la Excavadora diferenciada en 0 como fórmula
// sin resultado, otras secciones y las firmas
const hojaEp = (libro: Workbook, nombre = 'EP #08 MLC') => {
  const hoja = libro.addWorksheet(nombre);
  hoja.addRow(['CONTRATO Nº 1', 'CONTRATO Nº 1', 'CONTRATO Nº 1']);
  hoja.addRow([]);
  hoja.addRow(['ESTADO DE PAGO Nº 08']);
  hoja.addRow(['ITEM', 'DESCRIPCION', 'UNIDAD', 'CANTIDAD', 'P. UNITARIO', 'TOTAL']); // fila 4
  hoja.addRow([]);
  hoja.addRow([1, 'TARIFAS GARANTIZADAS', null, null, null, null, null, 'EQUIPOS', 'CANTIDAD', 'HRS MINIMAS']);
  hoja.addRow([1.1, 'Cargador Frontal', 'H.M.', { formula: 'L7', result: 600 }, { formula: '1*2', result: 135951.6919 }, { formula: 'E7*D7', result: 81571015 }, null, 'CARGADOR FRONTAL', 3, 540]);
  hoja.addRow(['1.2', 'Excavadora', 'H.M.', 184.70000000000073, 113277.1322, 20922286]);
  hoja.addRow([null, null, null, null, null, null, null, null, null, null, null, { formula: 'SUM(L7:L8)', result: 1850.6 }]); // total a la derecha
  hoja.addRow([2, 'Tarifas Diferenciadas']);
  hoja.addRow([2.1, 'Cargador Frontal', 'H.M.', 442, 115558.4689, 51076843]);
  hoja.addRow([2.2, 'Excavadora', 'H.M.', { formula: 'IF(L8-D8<0,0,L8-D8)' }, 96286.0317, { formula: 'ROUND(E12*D12,0)' }]);
  hoja.addRow([]);
  hoja.addRow([3, 'Camión aljibe']);
  hoja.addRow([3.1, 'Costo fijo integral por Camión Aljibe', 'GL', 1, 1303448.286, 1303448.286]);
  hoja.addRow([null, 'Total Neto Estado de Pago', null, null, null, 251856016]);
  hoja.addRow([null, 'Persona de Prueba', null, null, 'Otra Persona']); // firmas
  return hoja;
};

// Igual que el EP #08 (oct 2026): hojas con datos personales antes de "Base de datos", título y total arriba del
// encabezado (fila 4), "Equipo" es el tipo y "N° Interno" el código (numérico o de texto), fechas como Date o como
// número serial, horas como fracción del día y "Diferencia" como fórmula
const libroEp = async () => {
  const libro = new Workbook();
  libro.addWorksheet('R.HORAS').addRow(['N°', 'SAP', 'NOMBRE']).worksheet.addRow([1, 20012345, 'Persona de Prueba']);
  const hoja = libro.addWorksheet('Base de Datos');
  hoja.addRow([]);
  hoja.addRow([null, 'REGISTRO DE LAS HORAS DE EQUIPOS']);
  hoja.addRow([null, null, null, null, null, null, null, null, { formula: 'SUM(I5:I11)', result: 63.5 }]); // total
  hoja.addRow(['ID', 'Equipo', 'N° Interno', 'Codigo Report', 'Fecha', 'Hora Inicio', 'Horometro Inicial', 'Horometro Final', 'Diferencia', 'Area']);
  hoja.addRow([1, 'Cargador Frontal', 3239, 329001, new Date(Date.UTC(2026, 8, 25)), 0.1695, 28000, 28009, { formula: 'H5-G5', result: 9 }, 'Area 55']);
  hoja.addRow([2, 'Bulldozer', 'MA51525541', 329002, 46170, new Date(Date.UTC(1899, 11, 30, 19, 30)), 241.5, 248, 6.5, 'Tacho']);
  hoja.addRow([3, 'Bulldozer', null, 329003, 46171, 0.5, 248, 250, 2, 'Area 84']); // sin N° Interno
  hoja.addRow([4, 'Excavadora', 2108, 329004, 'no es fecha', 0.5, 1, 2, 1, 'Area 84']);
  hoja.addRow([5, 'Excavadora', 2108, 329005, '26-05-2026', '08:15', null, null, 30, 'Area 84']); // más de 24 h
  hoja.addRow([6, 'Bulldozer', 6406, 329006, '27/05/2026', '20:00', '100,5', '108,5', { formula: 'H10-G10', result: 8 }, null]);
  hoja.addRow([7, 'Bulldozer', 6406, 329007, '28/05/2026', '08:00', 108.5, 108.5, { sharedFormula: 'I10', result: 0 }, 'Api. 3001']);
  hoja.addRow([]);
  hojaEp(libro);
  return Buffer.from(await libro.xlsx.writeBuffer());
};

describe('LectorExcelEpExceljs', () => {
  const lector = new LectorExcelEpExceljs();

  it('lee solo la hoja "Base de datos" y normaliza códigos, fechas y horas', async () => {
    const lectura = await lector.leer(await libroEp());
    expect(lectura?.registros).toEqual([
      {
        fila: 5,
        idExcel: 1,
        equipo: '3239',
        categoria: 'Cargador Frontal',
        codigoReport: '329001',
        fecha: '2026-09-25',
        horaInicio: '04:04:05',
        horometroInicial: 28000,
        horometroFinal: 28009,
        horas: 9,
        area: 'Area 55',
      },
      expect.objectContaining({ fila: 6, idExcel: 2, equipo: 'MA51525541', categoria: 'Bulldozer', fecha: '2026-05-28', horaInicio: '19:30:00', horas: 6.5, area: 'Tacho' }),
      expect.objectContaining({
        fila: 10,
        equipo: '6406',
        fecha: '2026-05-27',
        horaInicio: '20:00:00',
        horometroInicial: 100.5,
        horometroFinal: 108.5,
        horas: 8,
        area: null,
      }),
      expect.objectContaining({ fila: 11, idExcel: 7, equipo: '6406', fecha: '2026-05-28', horas: 0, area: 'Api. 3001' }),
    ]);
    // El total de arriba y la fila vacía del final se ignoran sin error
    expect(lectura?.errores).toEqual([
      { fila: 7, mensaje: 'Falta el N° Interno del equipo' },
      { fila: 8, mensaje: 'La fecha no es válida' },
      { fila: 9, mensaje: 'Las horas deben estar entre 0 y 24' },
    ]);
  });

  it('acepta "Diferencia" en 0 aunque sea una fórmula (exceljs pierde el resultado 0)', async () => {
    const libro = new Workbook();
    hojaEp(libro);
    const hoja = libro.addWorksheet('Base de datos');
    hoja.addRow(['N° Interno', 'Fecha', 'Horometro Inicial', 'Horometro Final', 'Diferencia']);
    hoja.addRow([3239, '25/05/2026', 100, 100, { formula: 'D2-C2', result: 0 }]);
    hoja.addRow([3239, '26/05/2026', 100, 100, { sharedFormula: 'E2', result: 0 }]);
    hoja.addRow([3239, '27/05/2026', 100, 100, 0]);
    const lectura = await lector.leer(Buffer.from(await libro.xlsx.writeBuffer()));
    expect(lectura?.errores).toEqual([]);
    expect(lectura?.registros.map((r) => r.horas)).toEqual([0, 0, 0]);
  });

  it('guarda el ID del Excel y rechaza uno que no sea un número entero', async () => {
    const libro = new Workbook();
    hojaEp(libro);
    const hoja = libro.addWorksheet('Base de datos');
    hoja.addRow(['ID', 'N° Interno', 'Fecha', 'Diferencia']);
    hoja.addRow([12, 3239, '25/05/2026', 9]);
    hoja.addRow([null, 3239, '26/05/2026', 9]);
    hoja.addRow(['A1', 3239, '27/05/2026', 9]);
    hoja.addRow([1.5, 3239, '28/05/2026', 9]);
    const lectura = await lector.leer(Buffer.from(await libro.xlsx.writeBuffer()));
    expect(lectura?.registros.map((r) => r.idExcel)).toEqual([12, null]);
    expect(lectura?.errores).toEqual([
      { fila: 4, mensaje: 'El ID no es un número entero' },
      { fila: 5, mensaje: 'El ID no es un número entero' },
    ]);
  });

  it('avisa si falta la hoja o sus columnas obligatorias', async () => {
    const sinHoja = new Workbook();
    sinHoja.addWorksheet('Carátula EP').addRow(['CONTRATO']);
    expect(await lector.leer(Buffer.from(await sinHoja.xlsx.writeBuffer()))).toEqual({
      registros: [],
      tarifas: [],
      errores: [
        { fila: null, mensaje: 'No se encontró la hoja "Base de datos"' },
        { fila: null, mensaje: 'No se encontró la hoja del estado de pago ("EP #08 MLC", según el número del EP)' },
      ],
    });

    const sinColumnas = new Workbook();
    sinColumnas.addWorksheet('Base de datos').addRow(['Equipo', 'Fecha']);
    expect((await lector.leer(Buffer.from(await sinColumnas.xlsx.writeBuffer())))?.errores[0].mensaje).toContain('Diferencia');

    // Formato anterior al EP #08: el código venía en "Equipo" y no había "N° Interno"
    const formatoAnterior = new Workbook();
    hojaEp(formatoAnterior);
    formatoAnterior.addWorksheet('Base de datos').addRow(['ID', 'Equipo', 'Categoria', 'Fecha', 'Diferencia', 'Actividad']);
    expect((await lector.leer(Buffer.from(await formatoAnterior.xlsx.writeBuffer())))?.errores).toEqual([
      { fila: null, mensaje: 'La hoja "Base de datos" debe tener las columnas N° Interno, Fecha y Diferencia' },
    ]);
  });

  it('lee las tablas de tarifas de la hoja "EP #NN MLC", cualquiera sea el número del EP', async () => {
    const lectura = await lector.leer(await libroEp());
    expect(lectura?.tarifas).toEqual([
      { tipo: 'GARANTIZADA', fila: 7, item: '1.1', descripcion: 'Cargador Frontal', unidad: 'H.M.', cantidad: 600, precioUnitario: 135951.69, total: 81571015 },
      { tipo: 'GARANTIZADA', fila: 8, item: '1.2', descripcion: 'Excavadora', unidad: 'H.M.', cantidad: 184.7, precioUnitario: 113277.13, total: 20922286 },
      { tipo: 'DIFERENCIADA', fila: 11, item: '2.1', descripcion: 'Cargador Frontal', unidad: 'H.M.', cantidad: 442, precioUnitario: 115558.47, total: 51076843 },
      // fórmulas en 0: exceljs pierde el resultado
      { tipo: 'DIFERENCIADA', fila: 12, item: '2.2', descripcion: 'Excavadora', unidad: 'H.M.', cantidad: 0, precioUnitario: 96286.03, total: 0 },
    ]);

    const otroNumero = new Workbook();
    otroNumero.addWorksheet('Base de datos').addRow(['N° Interno', 'Fecha', 'Diferencia']);
    hojaEp(otroNumero, 'EP #12 MLC');
    const lecturaOtro = await lector.leer(Buffer.from(await otroNumero.xlsx.writeBuffer()));
    expect(lecturaOtro?.errores).toEqual([]);
    expect(lecturaOtro?.tarifas).toHaveLength(4);
  });

  it('avisa si en la hoja "EP #NN MLC" falta una tabla de tarifas o una fila no tiene números', async () => {
    const libro = new Workbook();
    libro.addWorksheet('Base de datos').addRow(['N° Interno', 'Fecha', 'Diferencia']);
    const hoja = libro.addWorksheet('EP #09 MLC');
    hoja.addRow(['ITEM', 'DESCRIPCION', 'UNIDAD', 'CANTIDAD', 'P. UNITARIO', 'TOTAL']);
    hoja.addRow([1, 'TARIFAS GARANTIZADAS']);
    hoja.addRow([1.1, 'Cargador Frontal', 'H.M.', 'muchas', 100, 200]);
    hoja.addRow([1.2, null, 'H.M.', 1, 100, 100]);
    expect((await lector.leer(Buffer.from(await libro.xlsx.writeBuffer())))?.errores).toEqual([
      { fila: null, mensaje: 'Hoja "EP #09 MLC", fila 3: Falta la cantidad o no es un número' },
      { fila: null, mensaje: 'Hoja "EP #09 MLC", fila 4: Falta la descripción' },
      { fila: null, mensaje: 'Hoja "EP #09 MLC": no tiene la tabla "Tarifas diferenciadas"' },
    ]);
  });

  it('devuelve null si el contenido no es un .xlsx', async () => {
    expect(await lector.leer(Buffer.from('PK\x03\x04 no es un zip de verdad'))).toBeNull();
  });
});
