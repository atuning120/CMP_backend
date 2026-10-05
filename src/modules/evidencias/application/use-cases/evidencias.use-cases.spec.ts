import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { Turno } from '../../../turnos/domain/entities/turno.entity';
import type { TurnoRepositoryPort } from '../../../turnos/domain/repositories/turno.repository.port';
import type { ReporteRegistro, ReporteRepositoryPort } from '../../domain/repositories/reporte.repository.port';
import type { EvidenciaRegistro, EvidenciaRepositoryPort } from '../../domain/repositories/evidencia.repository.port';
import type { AlmacenamientoArchivosPort } from '../../domain/ports/almacenamiento-archivos.port';
import { AlmacenamientoLocal } from '../../infrastructure/storage/almacenamiento-local';
import { CrearReporteUseCase } from './crear-reporte.use-case';
import { SubirEvidenciaUseCase } from './subir-evidencia.use-case';
import { ObtenerArchivoEvidenciaUseCase } from './obtener-archivo-evidencia.use-case';

const UUID_TURNO = '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7';
const UUID_REPORTE = '1a2b3c4d-5e6f-4a70-8b81-92c3d4e5f6a7';
const UUID_EVIDENCIA = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';
const turno = new Turno(1, 10, 20, new Date(Date.now() - 3600_000), null, 1000, null, 'EN_CURSO', UUID_TURNO);
const reporte: ReporteRegistro = { idReporte: 5, idTurno: 1, tipo: 'NOVEDAD', descripcion: 'Fuga', fechaHora: new Date(), idCliente: UUID_REPORTE };
const foto = { buffer: Buffer.from('jpeg'), mimetype: 'image/jpeg', size: 4 };

const crear = () => {
  const turnoRepo = {
    findById: jest.fn(async (id: number) => (id === 1 ? turno : null)),
    findByIdCliente: jest.fn(async (id: string) => (id === UUID_TURNO ? turno : null)),
  } as unknown as TurnoRepositoryPort;
  const reporteRepo = {
    findById: jest.fn(async (id: number) => (id === 5 ? reporte : null)),
    findByIdCliente: jest.fn<Promise<ReporteRegistro | null>, [string]>(async (id) => (id === UUID_REPORTE ? reporte : null)),
    create: jest.fn(async (data: Omit<ReporteRegistro, 'idReporte'>) => ({ idReporte: 6, ...data })),
  } satisfies ReporteRepositoryPort;
  const evidenciaRepo = {
    findByIdCliente: jest.fn<Promise<EvidenciaRegistro | null>, [string]>(async () => null),
    create: jest.fn(async (data: Omit<EvidenciaRegistro, 'idEvidencia'>) => ({ idEvidencia: 9, ...data })),
  } satisfies EvidenciaRepositoryPort;
  const archivos = new Map<string, Buffer>();
  const almacenamiento = {
    guardar: jest.fn(async (clave: string, contenido: Buffer) => { archivos.set(clave, contenido); }),
    leer: jest.fn(async (clave: string) => archivos.get(clave) ?? null),
  } satisfies AlmacenamientoArchivosPort;
  return {
    reporteRepo,
    evidenciaRepo,
    almacenamiento,
    crearReporte: new CrearReporteUseCase(reporteRepo, turnoRepo),
    subir: new SubirEvidenciaUseCase(evidenciaRepo, reporteRepo, turnoRepo, almacenamiento),
    obtener: new ObtenerArchivoEvidenciaUseCase(evidenciaRepo, reporteRepo, turnoRepo, almacenamiento),
  };
};

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('CrearReporteUseCase', () => {
  it('crea una novedad del turno propio y rechaza tipos inválidos', async () => {
    const { crearReporte, reporteRepo } = crear();
    const nuevo = '2b3c4d5e-6f7a-4b81-9c92-a3b4c5d6e7f8';

    const creado = await crearReporte.execute({ idOperador: 10, idCliente: nuevo, idClienteTurno: UUID_TURNO, tipo: 'FIN', descripcion: '  Sin novedades ' });

    expect(creado).toMatchObject({ idTurno: 1, tipo: 'FIN', descripcion: 'Sin novedades', idCliente: nuevo });
    expect(await codigoDe(crearReporte.execute({ idOperador: 10, idCliente: nuevo, idClienteTurno: UUID_TURNO, tipo: 'OTRO' }))).toBe('TIPO_REPORTE_INVALIDO');
    expect(await codigoDe(crearReporte.execute({ idOperador: 99, idCliente: nuevo, idClienteTurno: UUID_TURNO, tipo: 'FIN' }))).toBe('TURNO_NO_ENCONTRADO');
    expect(reporteRepo.create.mock.calls).toHaveLength(1);
  });
});

describe('SubirEvidenciaUseCase', () => {
  it('guarda el archivo y el registro; un reintento no duplica', async () => {
    const { subir, evidenciaRepo, almacenamiento } = crear();
    const dto = { idOperador: 10, idCliente: UUID_EVIDENCIA, idClienteReporte: UUID_REPORTE, archivo: foto };

    const evidencia = await subir.execute(dto);
    expect(evidencia.claveArchivo).toBe(`turno-1/${UUID_EVIDENCIA}.jpg`);
    expect(almacenamiento.guardar.mock.calls).toHaveLength(1);

    evidenciaRepo.findByIdCliente.mockResolvedValue(evidencia);
    await subir.execute(dto);
    expect(evidenciaRepo.create.mock.calls).toHaveLength(1);
  });

  it('rechaza archivos que no son imagen, vacíos o de un reporte ajeno', async () => {
    const { subir } = crear();
    const base = { idOperador: 10, idCliente: UUID_EVIDENCIA, idClienteReporte: UUID_REPORTE };
    expect(await codigoDe(subir.execute({ ...base, archivo: { ...foto, mimetype: 'application/pdf' } }))).toBe('ARCHIVO_INVALIDO');
    expect(await codigoDe(subir.execute({ ...base, archivo: { ...foto, size: 0 } }))).toBe('ARCHIVO_INVALIDO');
    expect(await codigoDe(subir.execute({ ...base, archivo: undefined }))).toBe('ARCHIVO_INVALIDO');
    expect(await codigoDe(subir.execute({ ...base, archivo: { ...foto, mimetype: 'application/octet-stream', originalname: 'x.pdf' } }))).toBe('ARCHIVO_INVALIDO');
    expect(await codigoDe(subir.execute({ ...base, idOperador: 99, archivo: foto }))).toBe('REPORTE_NO_ENCONTRADO');
  });

  it('acepta una imagen enviada como application/octet-stream si el nombre tiene extensión de imagen', async () => {
    const { subir } = crear();
    const evidencia = await subir.execute({
      idOperador: 10, idCliente: UUID_EVIDENCIA, idClienteReporte: UUID_REPORTE,
      archivo: { ...foto, mimetype: 'application/octet-stream', originalname: `${UUID_EVIDENCIA}.jpg` },
    });
    expect(evidencia.claveArchivo).toBe(`turno-1/${UUID_EVIDENCIA}.jpg`);
  });
});

describe('ObtenerArchivoEvidenciaUseCase', () => {
  it('el operador dueño y el jefe de turno pueden verla; otro operador no', async () => {
    const { subir, obtener, evidenciaRepo } = crear();
    const evidencia = await subir.execute({ idOperador: 10, idCliente: UUID_EVIDENCIA, idClienteReporte: UUID_REPORTE, archivo: foto });
    evidenciaRepo.findByIdCliente.mockResolvedValue(evidencia);

    await expect(obtener.execute(UUID_EVIDENCIA, { rol: 'OPERADOR', idOperador: 10 })).resolves.toMatchObject({ mimeType: 'image/jpeg' });
    await expect(obtener.execute(UUID_EVIDENCIA, { rol: 'JEFE_TURNO' })).resolves.toBeTruthy();
    expect(await codigoDe(obtener.execute(UUID_EVIDENCIA, { rol: 'OPERADOR', idOperador: 99 }))).toBe('EVIDENCIA_NO_ENCONTRADA');
  });
});

describe('AlmacenamientoLocal', () => {
  it('guarda y lee archivos, y no permite salir del directorio base', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'evidencias-'));
    const almacenamiento = new AlmacenamientoLocal({ get: () => dir } as unknown as ConfigService);
    try {
      await almacenamiento.guardar('turno-1/a.jpg', Buffer.from('x'));
      expect((await almacenamiento.leer('turno-1/a.jpg'))?.toString()).toBe('x');
      expect(await almacenamiento.leer('turno-1/no-existe.jpg')).toBeNull();
      await expect(almacenamiento.guardar('../fuera.jpg', Buffer.from('x'))).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
