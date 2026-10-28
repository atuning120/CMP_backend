import type { CargaEp, CargaEpRepositoryPort, RegistroEp } from '../../domain/repositories/carga-ep.repository.port';
import type { LecturaExcelEp, LectorExcelEpPort } from '../../domain/ports/lector-excel-ep.port';
import type { FirmadorDashboardPort } from '../../domain/ports/firmador-dashboard.port';
import { PrevisualizarCargaEpUseCase } from './previsualizar-carga-ep.use-case';
import { ConfirmarCargaEpUseCase } from './confirmar-carga-ep.use-case';
import { ListarCargasEpUseCase } from './listar-cargas-ep.use-case';
import { ObtenerDashboardUseCase } from './obtener-dashboard.use-case';

const registro = (fila: number, equipo: string, fecha: string, horas: number, actividad: string | null = 'Area 84'): RegistroEp => ({
  fila,
  equipo,
  categoria: 'Cargador Frontal',
  codigoReport: null,
  fecha,
  horaInicio: '08:00:00',
  horometroInicial: null,
  horometroFinal: null,
  horas,
  actividad,
});

const cargaJunio: CargaEp = {
  idCarga: 7,
  periodo: '2026-06',
  fechaDesde: '2026-05-25',
  fechaHasta: '2026-06-25',
  archivo: 'EP 04.xlsx',
  filas: 393,
  subidoPor: 'Ana Jefa',
  subidoEn: new Date('2026-07-01T12:00:00.000Z'),
};

// Basta la firma de un ZIP: el lector es un doble
const xlsx = (nombre = 'EP #04 MLC 06.2026.xlsx') => ({ buffer: Buffer.from('PK\x03\x04contenido'), size: 14, originalname: nombre });

const crear = (lectura: LecturaExcelEp | null, existente: CargaEp | null = null) => {
  const lector = { leer: jest.fn(async () => lectura) } satisfies LectorExcelEpPort;
  const cargaRepo = {
    listarVigentes: jest.fn(async () => [cargaJunio]),
    buscarVigente: jest.fn(async () => existente),
    equiposConocidos: jest.fn(async (codigos: string[]) => codigos.filter((c) => c !== 'MA999')),
    actividadesSinArea: jest.fn(async (textos: string[]) => textos.filter((t) => !t.startsWith('Area'))),
    reemplazar: jest.fn(async () => cargaJunio as CargaEp | null),
  } satisfies CargaEpRepositoryPort;
  const firmador = {
    firmar: jest.fn((_tipo, parametros: Record<string, string | number>, ahora: Date) => ({
      url: `https://mb/embed/dashboard/token?${JSON.stringify(parametros)}`,
      expiraEn: new Date(ahora.getTime() + 3600_000),
    })),
  } satisfies FirmadorDashboardPort;
  return {
    lector,
    cargaRepo,
    firmador,
    previsualizar: new PrevisualizarCargaEpUseCase(lector, cargaRepo),
    confirmar: new ConfirmarCargaEpUseCase(lector, cargaRepo),
    listar: new ListarCargasEpUseCase(cargaRepo),
    dashboard: new ObtenerDashboardUseCase(firmador, cargaRepo),
  };
};

const solicitud = { rol: 'JEFE_TURNO', periodo: '2026-06', fechaDesde: '2026-05-25', fechaHasta: '2026-06-25', archivo: xlsx() };

const codigoDe = async (promesa: Promise<unknown>) => {
  try {
    await promesa;
    return null;
  } catch (error) {
    return (error as { getResponse: () => { code: string } }).getResponse().code;
  }
};

describe('Carga del Excel del estado de pago', () => {
  const lecturaValida: LecturaExcelEp = {
    registros: [
      registro(2, '3239', '2026-05-25', 9),
      registro(3, '3239', '2026-06-01', 8.5, 'Tacho'),
      registro(4, 'MA999', '2026-06-25', 4, null),
    ],
    errores: [],
  };

  it('solo ADMIN y JEFE_TURNO cargan; valida período, rango y archivo antes de leerlo', async () => {
    const { previsualizar, lector } = crear(lecturaValida);
    expect(await codigoDe(previsualizar.execute({ ...solicitud, rol: 'VISOR' }))).toBe('SIN_PERMISO');
    expect(await codigoDe(previsualizar.execute({ ...solicitud, periodo: '2026-13' }))).toBe('PERIODO_INVALIDO');
    expect(await codigoDe(previsualizar.execute({ ...solicitud, fechaHasta: '2026-05-24' }))).toBe('RANGO_INVALIDO');
    expect(await codigoDe(previsualizar.execute({ ...solicitud, fechaDesde: '2026-02-30' }))).toBe('RANGO_INVALIDO');
    // más de 62 días o sin cruzar el mes del período
    expect(await codigoDe(previsualizar.execute({ ...solicitud, fechaDesde: '2026-04-01' }))).toBe('RANGO_INVALIDO');
    expect(await codigoDe(previsualizar.execute({ ...solicitud, fechaDesde: '2026-07-01', fechaHasta: '2026-07-25' }))).toBe('RANGO_INVALIDO');
    expect(await codigoDe(previsualizar.execute({ ...solicitud, archivo: undefined }))).toBe('ARCHIVO_INVALIDO');
    expect(await codigoDe(previsualizar.execute({ ...solicitud, archivo: { ...xlsx(), buffer: Buffer.from('<html>') } }))).toBe(
      'ARCHIVO_INVALIDO',
    );
    expect(lector.leer).not.toHaveBeenCalled();
  });

  it('la vista previa resume horas por equipo, equipos fuera de la flota y actividades sin área', async () => {
    const { previsualizar, cargaRepo } = crear(lecturaValida, cargaJunio);
    const vista = await previsualizar.execute(solicitud);
    expect(vista).toEqual({
      periodo: '2026-06',
      fechaDesde: '2026-05-25',
      fechaHasta: '2026-06-25',
      archivo: 'EP #04 MLC 06.2026.xlsx',
      errores: [],
      totalErrores: 0,
      horas: 21.5,
      equipos: [
        { equipo: '3239', registros: 2, horas: 17.5, enFlota: true },
        { equipo: 'MA999', registros: 1, horas: 4, enFlota: false },
      ],
      actividadesSinArea: ['Tacho'],
      cargaExistente: cargaJunio,
      filasValidas: 3,
      puedeConfirmar: true,
    });
    expect(cargaRepo.reemplazar).not.toHaveBeenCalled();
  });

  it('las filas fuera del rango del EP son errores y bloquean la confirmación', async () => {
    const { previsualizar, confirmar, cargaRepo } = crear({
      registros: [registro(2, '3239', '2026-05-24', 9), registro(3, '3239', '2026-05-25', 9)],
      errores: [{ fila: 9, mensaje: 'Falta el equipo' }],
    });
    const vista = await previsualizar.execute(solicitud);
    expect(vista.errores).toEqual([
      { fila: 2, mensaje: 'La fecha 2026-05-24 está fuera del rango del estado de pago' },
      { fila: 9, mensaje: 'Falta el equipo' },
    ]);
    expect(vista).toMatchObject({ filasValidas: 1, totalErrores: 2, puedeConfirmar: false });
    expect(await codigoDe(confirmar.execute({ ...solicitud, idUsuario: 3 }))).toBe('EXCEL_CON_ERRORES');
    expect(cargaRepo.reemplazar).not.toHaveBeenCalled();
  });

  it('confirma guardando solo la hoja leída; reemplazar un mes cargado exige confirmarlo', async () => {
    const { confirmar, cargaRepo } = crear(lecturaValida, cargaJunio);
    expect(await codigoDe(confirmar.execute({ ...solicitud, idUsuario: 3 }))).toBe('CARGA_EXISTENTE');

    await expect(confirmar.execute({ ...solicitud, idUsuario: 3, reemplazar: true })).resolves.toBe(cargaJunio);
    expect(cargaRepo.reemplazar).toHaveBeenCalledWith({
      periodo: '2026-06',
      fechaDesde: '2026-05-25',
      fechaHasta: '2026-06-25',
      archivo: 'EP #04 MLC 06.2026.xlsx',
      hashSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      idUsuario: 3,
      registros: lecturaValida.registros,
    });

    cargaRepo.reemplazar.mockResolvedValueOnce(null);
    expect(await codigoDe(confirmar.execute({ ...solicitud, idUsuario: 3, reemplazar: true }))).toBe('CARGA_SIMULTANEA');
  });

  it('un Excel sin filas no se confirma', async () => {
    const { confirmar } = crear({ registros: [], errores: [] });
    expect(await codigoDe(confirmar.execute({ ...solicitud, idUsuario: 3 }))).toBe('EXCEL_CON_ERRORES');
  });

  it('corrige el nombre del archivo que multer entrega en latin1', async () => {
    const { previsualizar } = crear(lecturaValida);
    const enLatin1 = Buffer.from('Estado de pago Ñuñoa.xlsx', 'utf8').toString('latin1');
    expect((await previsualizar.execute({ ...solicitud, archivo: xlsx(enLatin1) })).archivo).toBe('Estado de pago Ñuñoa.xlsx');
  });
});

describe('Dashboards', () => {
  const ahora = new Date('2026-07-02T15:00:00.000Z');

  it('todos los roles web ven los dashboards; el operador no', async () => {
    const { listar, dashboard } = crear(null);
    await expect(listar.execute('VISOR')).resolves.toEqual([cargaJunio]);
    expect(await codigoDe(listar.execute('OPERADOR'))).toBe('SIN_PERMISO');
    expect(await codigoDe(dashboard.execute({ rol: 'OPERADOR', tipo: 'OPERACION' }, ahora))).toBe('SIN_PERMISO');
  });

  it('operación va sin filtros bloqueados; estado de pago bloquea la carga vigente del mes', async () => {
    const { dashboard, firmador, cargaRepo } = crear(null, cargaJunio);
    await expect(dashboard.execute({ rol: 'VISOR', tipo: 'OPERACION' }, ahora)).resolves.toMatchObject({ carga: null });
    expect(firmador.firmar).toHaveBeenLastCalledWith('OPERACION', {}, ahora);

    const estadoPago = await dashboard.execute({ rol: 'ADMIN', tipo: 'ESTADO_PAGO', periodo: '2026-06' }, ahora);
    expect(firmador.firmar).toHaveBeenLastCalledWith('ESTADO_PAGO', { id_carga: 7 }, ahora);
    expect(cargaRepo.buscarVigente).toHaveBeenCalledWith('2026-06');
    expect(estadoPago).toMatchObject({ carga: cargaJunio, expiraEn: new Date('2026-07-02T16:00:00.000Z') });
  });

  it('errores: tipo desconocido, mes sin carga y Metabase sin configurar', async () => {
    const { dashboard, firmador } = crear(null, null);
    expect(await codigoDe(dashboard.execute({ rol: 'ADMIN', tipo: 'OTRO' }, ahora))).toBe('DASHBOARD_INVALIDO');
    expect(await codigoDe(dashboard.execute({ rol: 'ADMIN', tipo: 'ESTADO_PAGO' }, ahora))).toBe('PERIODO_INVALIDO');
    expect(await codigoDe(dashboard.execute({ rol: 'ADMIN', tipo: 'ESTADO_PAGO', periodo: '2026-06' }, ahora))).toBe('CARGA_NO_ENCONTRADA');
    firmador.firmar.mockReturnValueOnce(null as never);
    expect(await codigoDe(dashboard.execute({ rol: 'ADMIN', tipo: 'OPERACION' }, ahora))).toBe('METABASE_NO_CONFIGURADO');
  });
});
