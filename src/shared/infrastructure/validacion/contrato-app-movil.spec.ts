import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { ValidacionTiposPipe } from './validacion-tipos.pipe';
import { IniciarTurnoRequestDto } from '../../../modules/turnos/interface/http/dtos/iniciar-turno.request.dto';
import { FinalizarTurnoRequestDto } from '../../../modules/turnos/interface/http/dtos/finalizar-turno.request.dto';
import { RegistrarEstadoRequestDto } from '../../../modules/turnos/interface/http/dtos/registrar-estado.request.dto';
import { CambiarUbicacionRequestDto } from '../../../modules/turnos/interface/http/dtos/cambiar-ubicacion.request.dto';
import { CrearReporteRequestDto, SubirEvidenciaRequestDto } from '../../../modules/evidencias/interface/http/dtos/evidencias.request.dto';

/**
 * Contrato con la app móvil: los cuerpos que arma la cola offline (Front-mobile, src/services/operacionesTurno.ts y
 * src/sync/syncEngine.ts) deben pasar la validación sin cambios. La app marca con error, sin reintentar, toda operación
 * que reciba un 4xx: si un decorador rechazara uno de estos cuerpos, el operador perdería ese registro.
 */
const UUID = '0b3d5a52-1c4e-4f7a-9d2b-6e8f1a2b3c4d';
const UUID_TURNO = '7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2918';
const FECHA = '2026-11-11T12:30:00.000Z';

const pipe = new ValidacionTiposPipe();
const cuerpo = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({ type: 'body', metatype });

// Las operaciones referencian el turno por su UUID, o por { idTurno } si vino del servidor sin UUID ("srv-<id>")
const referencias = [{ idClienteTurno: UUID_TURNO }, { idTurno: 42 }];

const casos: [string, ArgumentMetadata['metatype'], Record<string, unknown>][] = [
  ['INICIAR_TURNO', IniciarTurnoRequestDto, { idCliente: UUID, fechaInicio: FECHA, idMaquina: 3, horometroInicial: 1250.5, idArea: 1, idZona: 7 }],
  ['INICIAR_TURNO sin zona', IniciarTurnoRequestDto, { idCliente: UUID, fechaInicio: FECHA, idMaquina: 3, horometroInicial: 0, idArea: 1, idZona: null }],
  // El controller convierte con Number(): números como texto se aceptan y deben seguir aceptándose
  ['INICIAR_TURNO con números como texto', IniciarTurnoRequestDto, { idCliente: UUID, idMaquina: '3', horometroInicial: '1250.5', idArea: '1' }],
  ...referencias.flatMap((ref): [string, ArgumentMetadata['metatype'], Record<string, unknown>][] => [
    ['FINALIZAR_TURNO', FinalizarTurnoRequestDto, { ...ref, horometroFinal: 1260, fechaFin: FECHA }],
    ['REGISTRAR_ESTADO', RegistrarEstadoRequestDto, { idCliente: UUID, ...ref, idEstado: 5, inicio: FECHA }],
    ['CAMBIAR_UBICACION', CambiarUbicacionRequestDto, { idCliente: UUID, ...ref, idArea: 1, idZona: null, inicio: FECHA }],
    ['CREAR_REPORTE', CrearReporteRequestDto, { idCliente: UUID, ...ref, tipo: 'NOVEDAD', descripcion: 'Fuga de aceite', fechaHora: FECHA }],
    ['CREAR_REPORTE sin descripción', CrearReporteRequestDto, { idCliente: UUID, ...ref, tipo: 'FIN', descripcion: null, fechaHora: FECHA }],
  ]),
  // multipart/form-data: todo llega como texto (el archivo va aparte, en @UploadedFile)
  ['SUBIR_EVIDENCIA', SubirEvidenciaRequestDto, { idCliente: UUID, idClienteReporte: UUID_TURNO, fechaHora: FECHA }],
];

describe('Contrato de validación con la app móvil', () => {
  it.each(casos)('%s pasa sin cambios', async (_operacion, metatype, body) => {
    await expect(pipe.transform(body, cuerpo(metatype))).resolves.toBe(body);
  });

  it('SUBIR_EVIDENCIA pasa con el cuerpo sin prototipo que arma multer', async () => {
    const body = Object.assign(Object.create(null) as Record<string, unknown>, { idCliente: UUID, idClienteReporte: UUID_TURNO, fechaHora: FECHA });
    await expect(pipe.transform(body, cuerpo(SubirEvidenciaRequestDto))).resolves.toBe(body);
  });

  it.each([
    ['comentario numérico en un estado', RegistrarEstadoRequestDto, { idCliente: UUID, idEstado: 5, comentario: 123 }, ['comentario']],
    ['descripción como objeto en un reporte', CrearReporteRequestDto, { idCliente: UUID, tipo: 'NOVEDAD', descripcion: { a: 1 } }, ['descripcion']],
    // multer entrega un campo repetido como arreglo: pasaba la regex del UUID y reventaba en toLowerCase()
    ['idCliente repetido en una evidencia', SubirEvidenciaRequestDto, { idCliente: [UUID, UUID], idClienteReporte: UUID }, ['idCliente']],
  ])('rechaza con 400 (y no 500) %s', async (_caso, metatype, body, campos) => {
    const error = (await pipe.transform(body, cuerpo(metatype)).catch((e: unknown) => e)) as BadRequestException;
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toMatchObject({ code: 'DATOS_INVALIDOS', campos });
  });
});
