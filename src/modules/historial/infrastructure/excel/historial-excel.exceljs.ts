import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import type { Border, CellValue, Fill, Worksheet } from 'exceljs';
import type { EventoHistorial, TipoEventoHistorial, TurnoConciliacion } from '../../domain/repositories/historial.repository.port';
import type { ContenidoExcelHistorial, DatosExcelHistorial, HistorialExcelPort } from '../../domain/ports/historial-excel.port';
import { desgloseTurno, horasTramo, tramosPorUbicacion, tramosTurno } from './tramos-turno';
import type { TipoTramo } from './tramos-turno';

// Los mismos textos que muestran el panel web y la app (HistorialEvento, ESTADOS_MAQUINA)
const TIPOS: Record<TipoEventoHistorial, { etiqueta: string; verbo: string }> = {
  INICIO_TURNO: { etiqueta: 'Inicio de turno', verbo: 'Inició turno en' },
  FIN_TURNO: { etiqueta: 'Cierre de turno', verbo: 'Cerró turno en' },
  CAMBIO_UBICACION: { etiqueta: 'Cambio de área/zona', verbo: 'Trasladó' },
  INCORPORAR: { etiqueta: 'Incorporación', verbo: 'Incorporó' },
  EDITAR: { etiqueta: 'Edición', verbo: 'Editó' },
  HABILITAR: { etiqueta: 'Habilitación', verbo: 'Habilitó' },
  DESHABILITAR: { etiqueta: 'Deshabilitación', verbo: 'Deshabilitó' },
  CAMBIAR_ESTADO: { etiqueta: 'Cambio de estado', verbo: 'Cambió el estado de' },
  REEMPLAZAR: { etiqueta: 'Reemplazo', verbo: 'Reemplazó' },
  DEVOLVER: { etiqueta: 'Devolución', verbo: 'Devolvió a operación' },
};

const EVENTOS_DE_TURNO: TipoEventoHistorial[] = ['INICIO_TURNO', 'FIN_TURNO', 'CAMBIO_UBICACION'];

const ESTADOS_MAQUINA: Record<string, string> = {
  ACTIVA: 'Operativa',
  BAJO_OBSERVACION: 'Operativa bajo observación',
  EN_MANTENIMIENTO: 'En mantenimiento',
  EN_RESERVA: 'En reserva',
  BAJA: 'Fuera de servicio',
};

const ESTADOS_TURNO: Record<string, string> = { EN_CURSO: 'En curso', CERRADO: 'Cerrado', CERRADO_AUTO: 'Cierre automático' };

// Campos de la ficha que registra una edición (detalle.antes / detalle.despues)
const CAMPOS_FICHA: Record<string, string> = {
  nombre: 'Código',
  marca: 'Marca',
  modelo: 'Modelo',
  anio: 'Año',
  tipoMaquina: 'Tipo de máquina',
  patente: 'Patente',
  numeroChasis: 'N° de chasis',
  esContratista: 'Contratista',
  operador: 'Operador',
  regresoEstimado: 'Regreso estimado',
};

interface Columna {
  clave: string;
  titulo: string;
  ancho: number;
  formato?: string;
  ajustar?: boolean; // texto largo: varias líneas dentro de la celda
  tramo?: TipoTramo; // horas de ese grupo: encabezado y celdas con su color
}

const HORAS = '#,##0.0';

// Mismos grupos y colores que el operador ve en la app al cambiar de estado (verde, amarillo, rojo)
const TRAMOS: Record<TipoTramo, { etiqueta: string; fuerte: string; texto: string; suave: string }> = {
  EFECTIVO: { etiqueta: 'Horas efectivas', fuerte: 'FF1E8E3E', texto: 'FFFFFFFF', suave: 'FFE6F4EA' },
  DEMORA: { etiqueta: 'Demoras operacionales', fuerte: 'FFF9AB00', texto: 'FF000000', suave: 'FFFEF7E0' },
  MANTENCION: { etiqueta: 'Mantención y fallas', fuerte: 'FFD93025', texto: 'FFFFFFFF', suave: 'FFFCE8E6' },
  SIN_ESTADO: { etiqueta: 'Sin estado registrado', fuerte: 'FF80868B', texto: 'FFFFFFFF', suave: 'FFF1F3F4' },
};

// Horas del turno por grupo de estado; suman la duración del turno
const COLUMNAS_TRAMOS: Columna[] = [
  { clave: 'efectivas', titulo: 'Horas efectivas', ancho: 11, formato: HORAS, tramo: 'EFECTIVO' },
  { clave: 'demoras', titulo: 'Demoras operacionales (hrs)', ancho: 12, formato: HORAS, tramo: 'DEMORA' },
  { clave: 'mantencion', titulo: 'Mantención y fallas (hrs)', ancho: 12, formato: HORAS, tramo: 'MANTENCION' },
  { clave: 'sinEstado', titulo: 'Sin estado registrado (hrs)', ancho: 12, formato: HORAS, tramo: 'SIN_ESTADO' },
];
const CLAVE_TRAMO: Record<TipoTramo, string> = { EFECTIVO: 'efectivas', DEMORA: 'demoras', MANTENCION: 'mantencion', SIN_ESTADO: 'sinEstado' };

// Las primeras columnas siguen el orden del reporte mensual de la contratista (equipo, categoría, fecha, hora,
// horómetros, diferencia, área) para compararlos lado a lado; después lo que solo registra GeoPlanta
const COLUMNAS_TURNOS: Columna[] = [
  { clave: 'n', titulo: 'N°', ancho: 6 },
  { clave: 'equipo', titulo: 'Equipo', ancho: 12 },
  { clave: 'categoria', titulo: 'Categoría', ancho: 17 },
  { clave: 'fecha', titulo: 'Fecha', ancho: 11, formato: 'dd-mm-yyyy' },
  { clave: 'turno', titulo: 'Turno', ancho: 8 },
  { clave: 'horaInicio', titulo: 'Hora inicio', ancho: 9, formato: 'hh:mm' },
  { clave: 'horometroInicial', titulo: 'Horómetro inicial', ancho: 11, formato: HORAS },
  { clave: 'horometroFinal', titulo: 'Horómetro final', ancho: 11, formato: HORAS },
  { clave: 'diferencia', titulo: 'Diferencia (hrs)', ancho: 11, formato: HORAS },
  { clave: 'area', titulo: 'Área', ancho: 30, ajustar: true },
  { clave: 'zona', titulo: 'Zona', ancho: 26, ajustar: true },
  { clave: 'serie', titulo: 'Patente / N° serie', ancho: 18 },
  { clave: 'contratista', titulo: 'Contratista', ancho: 11 },
  { clave: 'operador', titulo: 'Operador', ancho: 24 },
  { clave: 'horaTermino', titulo: 'Término', ancho: 16, formato: 'dd-mm-yyyy hh:mm' },
  { clave: 'duracion', titulo: 'Duración (hrs)', ancho: 11, formato: HORAS },
  ...COLUMNAS_TRAMOS,
  { clave: 'estado', titulo: 'Estado', ancho: 16 },
  { clave: 'revisar', titulo: 'Revisar', ancho: 9 },
  { clave: 'observaciones', titulo: 'Observaciones', ancho: 44, ajustar: true },
];

const COLUMNAS_RESUMEN: Columna[] = [
  { clave: 'equipo', titulo: 'Equipo', ancho: 12 },
  { clave: 'categoria', titulo: 'Categoría', ancho: 17 },
  { clave: 'serie', titulo: 'Patente / N° serie', ancho: 18 },
  { clave: 'contratista', titulo: 'Contratista', ancho: 11 },
  { clave: 'turnos', titulo: 'Turnos', ancho: 9 },
  { clave: 'horas', titulo: 'Horas horómetro', ancho: 12, formato: HORAS },
  { clave: 'duracion', titulo: 'Horas en turno', ancho: 12, formato: HORAS },
  ...COLUMNAS_TRAMOS,
  { clave: 'revisar', titulo: 'Turnos a revisar', ancho: 10 },
  { clave: 'horasContratista', titulo: 'Horas según contratista', ancho: 13, formato: HORAS },
  { clave: 'diferencia', titulo: 'Diferencia (contratista − GeoPlanta)', ancho: 16, formato: `${HORAS};[Red]-${HORAS}` },
];

// Un tramo por estado operacional y ubicación: al filtrar por categoría o área se ven sus horas
const COLUMNAS_ESTADOS: Columna[] = [
  { clave: 'n', titulo: 'N° turno', ancho: 8 },
  { clave: 'equipo', titulo: 'Equipo', ancho: 12 },
  { clave: 'operador', titulo: 'Operador', ancho: 24 },
  { clave: 'fecha', titulo: 'Fecha', ancho: 11, formato: 'dd-mm-yyyy' },
  { clave: 'inicio', titulo: 'Inicio', ancho: 8, formato: 'hh:mm' },
  { clave: 'termino', titulo: 'Término', ancho: 8, formato: 'hh:mm' },
  { clave: 'horas', titulo: 'Horas', ancho: 9, formato: HORAS },
  { clave: 'categoria', titulo: 'Categoría', ancho: 22 },
  { clave: 'estado', titulo: 'Estado operacional', ancho: 30, ajustar: true },
  { clave: 'area', titulo: 'Área', ancho: 30, ajustar: true },
  { clave: 'zona', titulo: 'Zona', ancho: 22, ajustar: true },
];

const COLUMNAS_MOVIMIENTOS: Columna[] = [
  { clave: 'fecha', titulo: 'Fecha', ancho: 11, formato: 'dd-mm-yyyy' },
  { clave: 'hora', titulo: 'Hora', ancho: 8, formato: 'hh:mm' },
  { clave: 'tipo', titulo: 'Tipo', ancho: 18 },
  { clave: 'equipo', titulo: 'Equipo', ancho: 12 },
  { clave: 'descripcion', titulo: 'Descripción', ancho: 48, ajustar: true },
  { clave: 'estadoAnterior', titulo: 'Estado anterior', ancho: 20 },
  { clave: 'estadoNuevo', titulo: 'Estado nuevo', ancho: 20 },
  { clave: 'motivo', titulo: 'Motivo', ancho: 24, ajustar: true },
  { clave: 'observacion', titulo: 'Observación', ancho: 36, ajustar: true },
  { clave: 'actor', titulo: 'Realizado por', ancho: 24 },
];

type Fila = Record<string, CellValue>;

const FILA_ENCABEZADO = 5;
const COLOR_ENCABEZADO = 'FF1F4E79';
const COLOR_ALTERNO = 'FFF2F6FA';
const COLOR_REVISAR = 'FFFFF2CC';
const COLOR_INGRESO = 'FFFFFBE6';
const COLOR_TOTAL = 'FFDDE7F0';
const BORDE: Partial<Border> = { style: 'thin', color: { argb: 'FFD0D7DE' } };

const relleno = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

const texto = (valor: unknown): string | null => (typeof valor === 'string' && valor.trim() !== '' ? valor : null);

const objeto = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};

const estadoMaquina = (valor: unknown) => {
  const estado = texto(valor);
  return estado ? (ESTADOS_MAQUINA[estado] ?? estado) : null;
};

// Horómetros con decimales: 8381.8 - 8372.8 no debe quedar en 9.000000000001
const redondear = (valor: number) => Math.round(valor * 100) / 100;

const serieDe = (equipo: TurnoConciliacion['equipo']) => [equipo.patente, equipo.numeroChasis].filter(Boolean).join(' / ') || null;

// Lo que conviene mirar antes de comparar con la contratista
const observacionesTurno = (turno: TurnoConciliacion, diferencia: number | null, duracion: number | null): string[] => {
  const notas: string[] = [];
  if (turno.estado === 'EN_CURSO') notas.push('Turno en curso');
  else if (turno.horometroFinal === null) notas.push('Sin horómetro final');
  if (diferencia !== null && diferencia < 0) notas.push('Horómetro final menor al inicial');
  if (diferencia !== null && duracion !== null && diferencia > duracion + 0.5) notas.push('El horómetro avanzó más que la duración del turno');
  if (turno.cerradoPor) notas.push(`Cerrado por ${turno.cerradoPor}${turno.motivoCierre ? `: ${turno.motivoCierre}` : ''}`);
  else if (turno.estado === 'CERRADO_AUTO') notas.push('Cierre automático: el operador no lo finalizó');
  if (turno.conflicto) notas.push(`Conflicto: ${turno.conflicto}`);
  return notas;
};

// Título del reporte en las primeras filas de cada hoja
const encabezadoHoja = (hoja: Worksheet, titulo: string, lineas: string[]) => {
  hoja.getCell('A1').value = titulo;
  hoja.getCell('A1').font = { bold: true, size: 14, color: { argb: COLOR_ENCABEZADO } };
  lineas.forEach((linea, i) => {
    const celda = hoja.getCell(`A${i + 2}`);
    celda.value = linea;
    if (i > 0) celda.font = { italic: true, color: { argb: 'FF6B7280' } };
  });
};

/**
 * Tabla con encabezado fijo y filtros desde la fila FILA_ENCABEZADO. destacar(i) da el color de fondo de una fila
 * (null = sin color). Devuelve el número de la última fila escrita.
 */
const escribirTabla = (hoja: Worksheet, columnas: Columna[], filas: Fila[], destacar: (i: number) => string | null) => {
  hoja.columns = columnas.map((c) => ({ key: c.clave, width: c.ancho }));
  hoja.views = [{ state: 'frozen', ySplit: FILA_ENCABEZADO }];

  const encabezado = hoja.getRow(FILA_ENCABEZADO);
  encabezado.values = columnas.map((c) => c.titulo);
  encabezado.height = 32;
  encabezado.eachCell((celda, numero) => {
    const tramo = columnas[numero - 1].tramo;
    celda.font = { bold: true, color: { argb: tramo ? TRAMOS[tramo].texto : 'FFFFFFFF' } };
    celda.fill = relleno(tramo ? TRAMOS[tramo].fuerte : COLOR_ENCABEZADO);
    celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    celda.border = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
  });

  filas.forEach((datos, i) => {
    const fila = hoja.getRow(FILA_ENCABEZADO + 1 + i);
    const color = destacar(i);
    columnas.forEach((columna, j) => {
      const celda = fila.getCell(j + 1);
      celda.value = datos[columna.clave] ?? null;
      if (columna.formato) celda.numFmt = columna.formato;
      celda.alignment = { vertical: 'top', wrapText: columna.ajustar ?? false };
      celda.border = { bottom: BORDE };
      if (columna.tramo) celda.fill = relleno(TRAMOS[columna.tramo].suave);
      else if (color) celda.fill = relleno(color);
    });
  });

  const ultima = FILA_ENCABEZADO + Math.max(filas.length, 1);
  hoja.autoFilter = { from: { row: FILA_ENCABEZADO, column: 1 }, to: { row: ultima, column: columnas.length } };
  return ultima;
};

const letra = (hoja: Worksheet, clave: string) => hoja.getColumn(clave).letter;

@Injectable()
export class HistorialExcelExceljs implements HistorialExcelPort {
  async generar(contenido: ContenidoExcelHistorial, datos: DatosExcelHistorial): Promise<Buffer> {
    const { zonaHoraria } = datos;
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    // Excel no guarda zona horaria y ExcelJS escribe las fechas en UTC: se pasa la hora local como si fuera UTC
    const enZona = (fecha: Date): Date => {
      const p = Object.fromEntries(partes.formatToParts(fecha).map((parte) => [parte.type, Number(parte.value)]));
      return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
    };
    const fechaTexto = (fecha: Date) => fecha.toLocaleDateString('es-CL', { timeZone: zonaHoraria });
    const fechaHoraTexto = (fecha: Date) =>
      `${fechaTexto(fecha)} ${fecha.toLocaleTimeString('es-CL', { timeZone: zonaHoraria, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`;
    const fechaDe = (valor: unknown): Date | null => {
      const iso = texto(valor);
      const fecha = iso ? new Date(iso) : null;
      return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
    };

    const rango = `${fechaTexto(datos.desde)} al ${fechaTexto(new Date(datos.hasta.getTime() - 1))}`;
    const generado = `Generado el ${fechaHoraTexto(datos.generado)} (hora ${zonaHoraria}), del más antiguo al más reciente`;

    const libro = new Workbook();
    libro.creator = 'CMP';
    libro.created = datos.generado;

    if (datos.tipo !== 'FLOTA') {
      // Hoja 1: una fila por cada área/zona de cada turno (cada una con su desglose de horas), para cotejar con el
      // reporte de la contratista. El horómetro se lee al inicio y al cierre del turno: va solo en su primera fila
      const turnos = contenido.turnos.map((turno, i) => {
        const inicio = enZona(new Date(turno.horaInicio));
        const diferencia = turno.horometroFinal === null ? null : redondear(turno.horometroFinal - turno.horometroInicial);
        const duracion = turno.horaTermino
          ? redondear((new Date(turno.horaTermino).getTime() - new Date(turno.horaInicio).getTime()) / 3600000)
          : null;
        const notas = observacionesTurno(turno, diferencia, duracion);
        const tramos = tramosTurno(turno);
        // Un turno en curso no tiene tramos: sus columnas de horas quedan vacías
        const desglose = tramos.length > 0 ? desgloseTurno(tramos) : null;
        const hora = inicio.getUTCHours();
        const filas = tramosPorUbicacion(turno).map<Fila>((ubicacion, j) => {
          const desgloseUbicacion = ubicacion.tramos.length > 0 ? desgloseTurno(ubicacion.tramos) : null;
          const primera = j === 0;
          return {
            n: i + 1,
            equipo: turno.equipo.codigo,
            categoria: turno.equipo.tipo,
            fecha: new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate())),
            // Los turnos de día parten cerca de las 07:00 y los de noche cerca de las 19:00
            turno: hora >= 5 && hora < 17 ? 'Día' : 'Noche',
            horaInicio: enZona(ubicacion.inicio),
            horometroInicial: primera ? turno.horometroInicial : null,
            horometroFinal: primera ? turno.horometroFinal : null,
            diferencia: primera ? diferencia : null,
            area: ubicacion.area,
            zona: ubicacion.zona,
            serie: serieDe(turno.equipo),
            contratista: turno.equipo.esContratista ? 'Sí' : 'No',
            operador: turno.operador,
            horaTermino: ubicacion.fin ? enZona(ubicacion.fin) : null,
            duracion: ubicacion.fin ? redondear((ubicacion.fin.getTime() - ubicacion.inicio.getTime()) / 3600000) : null,
            ...Object.fromEntries(
              (Object.keys(CLAVE_TRAMO) as TipoTramo[]).map((tipo) => [
                CLAVE_TRAMO[tipo],
                desgloseUbicacion ? redondear(desgloseUbicacion[tipo]) : null,
              ]),
            ),
            estado: ESTADOS_TURNO[turno.estado] ?? turno.estado,
            revisar: notas.length > 0 ? 'Sí' : null,
            observaciones: primera ? notas.join(' · ') || null : null,
          };
        });
        return { turno, filas, diferencia, duracion, tramos, desglose, revisar: notas.length > 0 };
      });
      // Cada fila del Excel con el turno al que pertenece (un turno ocupa tantas filas como ubicaciones tuvo)
      const filasTurnos = turnos.flatMap((t) => t.filas.map((fila, j) => ({ fila, primera: j === 0, turno: t })));

      const hoja = libro.addWorksheet('Turnos');
      encabezadoHoja(hoja, 'Turnos por equipo', [
        `Rango: ${rango}  ·  ${turnos.length} turnos  ·  Una fila por área/zona de cada turno; el horómetro va en su primera fila  ·  En amarillo, los turnos con algo que revisar antes de comparar`,
        generado,
      ]);
      const ultima = escribirTabla(
        hoja,
        COLUMNAS_TURNOS,
        filasTurnos.map((f) => f.fila),
        (i) => (filasTurnos[i].turno.revisar ? COLOR_REVISAR : null),
      );

      // Diferencia como fórmula: si se corrige un horómetro a mano, la diferencia y los totales se recalculan
      const [ini, fin, dif, dur] = ['horometroInicial', 'horometroFinal', 'diferencia', 'duracion'].map((clave) => letra(hoja, clave));
      filasTurnos.forEach((f, i) => {
        const fila = FILA_ENCABEZADO + 1 + i;
        if (f.primera && f.turno.diferencia !== null) {
          hoja.getCell(`${dif}${fila}`).value = { formula: `${fin}${fila}-${ini}${fila}`, result: f.turno.diferencia };
        }
      });

      // Totales sobre las filas visibles (SUBTOTAL 109): al filtrar por equipo muestran sus horas del período
      const total = (columna: string, valor: number) => {
        const celda = hoja.getCell(`${columna}4`);
        celda.value = { formula: `SUBTOTAL(109,${columna}${FILA_ENCABEZADO + 1}:${columna}${ultima})`, result: redondear(valor) };
        celda.numFmt = HORAS;
        celda.font = { bold: true };
        celda.fill = relleno(COLOR_TOTAL);
      };
      const etiqueta = hoja.getCell(`${fin}4`);
      etiqueta.value = 'Total filas visibles';
      etiqueta.font = { bold: true };
      etiqueta.alignment = { horizontal: 'right' };
      const sumaFilas = (clave: string) => filasTurnos.reduce((suma, f) => suma + (Number(f.fila[clave]) || 0), 0);
      total(dif, sumaFilas('diferencia'));
      total(dur, sumaFilas('duracion'));
      for (const clave of Object.values(CLAVE_TRAMO)) total(letra(hoja, clave), sumaFilas(clave));

      // Hoja 2: horas del período por equipo, con una columna para anotar las que cobra la contratista
      const equipos = new Map<
        string,
        { turno: TurnoConciliacion; turnos: number; horas: number; duracion: number; revisar: number; desglose: Record<TipoTramo, number> }
      >();
      for (const t of turnos) {
        const resumen = equipos.get(t.turno.equipo.codigo) ?? {
          turno: t.turno,
          turnos: 0,
          horas: 0,
          duracion: 0,
          revisar: 0,
          desglose: { EFECTIVO: 0, DEMORA: 0, MANTENCION: 0, SIN_ESTADO: 0 },
        };
        resumen.turnos += 1;
        resumen.horas += t.diferencia ?? 0;
        resumen.duracion += t.duracion ?? 0;
        resumen.revisar += t.revisar ? 1 : 0;
        for (const tipo of Object.keys(CLAVE_TRAMO) as TipoTramo[]) resumen.desglose[tipo] += t.desglose?.[tipo] ?? 0;
        equipos.set(t.turno.equipo.codigo, resumen);
      }
      const filasResumen = [...equipos.values()]
        .sort((a, b) => a.turno.equipo.codigo.localeCompare(b.turno.equipo.codigo, 'es', { numeric: true }))
        .map<Fila>((r) => ({
          equipo: r.turno.equipo.codigo,
          categoria: r.turno.equipo.tipo,
          serie: serieDe(r.turno.equipo),
          contratista: r.turno.equipo.esContratista ? 'Sí' : 'No',
          turnos: r.turnos,
          horas: redondear(r.horas),
          duracion: redondear(r.duracion),
          ...Object.fromEntries((Object.keys(CLAVE_TRAMO) as TipoTramo[]).map((tipo) => [CLAVE_TRAMO[tipo], redondear(r.desglose[tipo])])),
          revisar: r.revisar || null,
          horasContratista: null,
        }));

      const resumen = libro.addWorksheet('Resumen por equipo');
      encabezadoHoja(resumen, 'Horas por equipo', [
        `Rango: ${rango}  ·  Anota en «Horas según contratista» el total de su reporte del mes para ver la diferencia`,
        generado,
      ]);
      const ultimaResumen = escribirTabla(resumen, COLUMNAS_RESUMEN, filasResumen, () => null);
      const [horas, contratista, diferencia] = ['horas', 'horasContratista', 'diferencia'].map((clave) => letra(resumen, clave));
      filasResumen.forEach((_, i) => {
        const fila = FILA_ENCABEZADO + 1 + i;
        resumen.getCell(`${contratista}${fila}`).fill = relleno(COLOR_INGRESO);
        resumen.getCell(`${diferencia}${fila}`).value = { formula: `IF(${contratista}${fila}="","",${contratista}${fila}-${horas}${fila})`, result: '' };
      });
      if (filasResumen.length > 0) {
        const filaTotal = resumen.getRow(ultimaResumen + 1);
        filaTotal.getCell(1).value = 'Total';
        COLUMNAS_RESUMEN.forEach((columna, j) => {
          const celda = filaTotal.getCell(j + 1);
          if (['turnos', 'horas', 'duracion', ...Object.values(CLAVE_TRAMO), 'revisar', 'horasContratista', 'diferencia'].includes(columna.clave)) {
            const l = letra(resumen, columna.clave);
            celda.value = { formula: `SUM(${l}${FILA_ENCABEZADO + 1}:${l}${ultimaResumen})` };
            if (columna.formato) celda.numFmt = columna.formato;
          }
          celda.font = { bold: true };
          celda.fill = relleno(COLOR_TOTAL);
          celda.border = { top: BORDE };
        });
      }

      // Hoja 3: la línea de tiempo de cada turno cerrado, con los colores de los estados en la app
      const tramos = turnos.flatMap((t, i) =>
        t.tramos.map((tramo) => {
          const inicioTramo = enZona(tramo.inicio);
          const fila: Fila = {
            n: i + 1,
            equipo: t.turno.equipo.codigo,
            operador: t.turno.operador,
            fecha: new Date(Date.UTC(inicioTramo.getUTCFullYear(), inicioTramo.getUTCMonth(), inicioTramo.getUTCDate())),
            inicio: inicioTramo,
            termino: enZona(tramo.fin),
            horas: redondear(horasTramo(tramo)),
            categoria: TRAMOS[tramo.tipo].etiqueta,
            estado: tramo.estado,
            area: tramo.area,
            zona: tramo.zona,
          };
          return { tipo: tramo.tipo, fila };
        }),
      );
      const hojaEstados = libro.addWorksheet('Estados operacionales');
      encabezadoHoja(hojaEstados, 'Estados operacionales por turno', [
        `Rango: ${rango}  ·  ${tramos.length} tramos de turnos cerrados  ·  Filtra por Categoría o Área para ver sus horas (verde: efectivas, amarillo: demoras, rojo: mantención y fallas)`,
        generado,
      ]);
      const ultimaEstados = escribirTabla(
        hojaEstados,
        COLUMNAS_ESTADOS,
        tramos.map((t) => t.fila),
        (i) => TRAMOS[tramos[i].tipo].suave,
      );
      const horasEstados = letra(hojaEstados, 'horas');
      const etiquetaEstados = hojaEstados.getCell(`${letra(hojaEstados, 'termino')}4`);
      etiquetaEstados.value = 'Total filas visibles';
      etiquetaEstados.font = { bold: true };
      etiquetaEstados.alignment = { horizontal: 'right' };
      const totalEstados = hojaEstados.getCell(`${horasEstados}4`);
      totalEstados.value = {
        formula: `SUBTOTAL(109,${horasEstados}${FILA_ENCABEZADO + 1}:${horasEstados}${ultimaEstados})`,
        result: redondear(tramos.reduce((suma, t) => suma + Number(t.fila.horas), 0)),
      };
      totalEstados.numFmt = HORAS;
      totalEstados.font = { bold: true };
      totalEstados.fill = relleno(COLOR_TOTAL);
    }

    if (datos.tipo !== 'TURNOS') {
      const valorFicha = (campo: string, valor: unknown): string => {
        if (valor === null || valor === undefined || valor === '') return '—';
        if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
        if (campo === 'regresoEstimado') {
          const fecha = fechaDe(valor);
          return fecha ? fechaTexto(fecha) : '—';
        }
        return typeof valor === 'string' || typeof valor === 'number' ? String(valor) : JSON.stringify(valor);
      };

      const descripcion = (evento: EventoHistorial): string => {
        const detalle = objeto(evento.detalle);
        const despues = objeto(detalle.despues);
        const antes = objeto(detalle.antes);
        const partesTexto = [`${TIPOS[evento.tipo].verbo} ${evento.maquina.nombre}`];
        switch (evento.tipo) {
          case 'INCORPORAR':
            if (texto(detalle.reemplazaA)) partesTexto[0] += ` en reemplazo de ${String(detalle.reemplazaA)}`;
            break;
          case 'EDITAR': {
            const cambios = Object.keys(despues).map(
              (campo) => `${CAMPOS_FICHA[campo] ?? campo}: ${valorFicha(campo, antes[campo])} → ${valorFicha(campo, despues[campo])}`,
            );
            if (cambios.length > 0) partesTexto[0] += `: ${cambios.join('; ')}`;
            break;
          }
          case 'REEMPLAZAR':
            if (texto(detalle.entrante)) partesTexto[0] += ` por ${String(detalle.entrante)}`;
            break;
          case 'DEVOLVER':
            if (texto(detalle.respaldo)) partesTexto.push(`sale el respaldo ${String(detalle.respaldo)}`);
            break;
          case 'HABILITAR':
          case 'DESHABILITAR':
          case 'CAMBIAR_ESTADO':
            if (texto(detalle.reemplazaA)) partesTexto.push(`entra en reemplazo de ${String(detalle.reemplazaA)}`);
            if (texto(detalle.devueltaA)) partesTexto.push(`respaldo devuelto por ${String(detalle.devueltaA)}`);
            break;
          default:
            break;
        }
        if (evento.tipo !== 'EDITAR' && texto(detalle.operador)) partesTexto.push(`operador ${String(detalle.operador)}`);
        const regreso = evento.tipo === 'EDITAR' ? null : fechaDe(despues.regresoEstimado);
        if (regreso) partesTexto.push(`regreso estimado ${fechaTexto(regreso)}`);
        return partesTexto.join(' · ');
      };

      // Hoja 4: mantenciones, reemplazos y cambios de estado; explican los días en que un equipo no tuvo turnos
      const movimientos = contenido.movimientos
        // Los turnos (inicios, cierres y cambios de área) ya están en sus propias hojas
        .filter((evento) => !EVENTOS_DE_TURNO.includes(evento.tipo) && TIPOS[evento.tipo])
        .map<Fila>((evento) => {
          const detalle = objeto(evento.detalle);
          const fecha = enZona(new Date(evento.fecha));
          return {
            fecha,
            hora: fecha,
            tipo: TIPOS[evento.tipo].etiqueta,
            equipo: evento.maquina.nombre,
            descripcion: descripcion(evento),
            estadoAnterior: estadoMaquina(objeto(detalle.antes).estado),
            estadoNuevo: estadoMaquina(objeto(detalle.despues).estado),
            motivo: evento.motivo,
            observacion: evento.observacion,
            actor: evento.actor,
          };
        });

      const hoja = libro.addWorksheet('Movimientos de flota');
      encabezadoHoja(hoja, 'Movimientos de flota', [
        `Rango: ${rango}  ·  ${movimientos.length} movimientos  ·  Mantenciones, reemplazos y cambios de estado de los equipos`,
        generado,
      ]);
      escribirTabla(hoja, COLUMNAS_MOVIMIENTOS, movimientos, (i) => (i % 2 === 1 ? COLOR_ALTERNO : null));
    }

    return Buffer.from(await libro.xlsx.writeBuffer());
  }
}
