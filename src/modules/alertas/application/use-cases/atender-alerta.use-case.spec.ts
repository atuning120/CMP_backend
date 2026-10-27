import type { AlertaTurnoRepositoryPort, AtencionAlerta, TipoAlertaTurno } from '../../domain/repositories/alerta-turno.repository.port';
import type { AtencionAlertaRepositoryPort } from '../../domain/repositories/atencion-alerta.repository.port';
import type { PublicadorAlertasPort } from '../ports/publicador-alertas.port';
import { AtenderAlertaUseCase } from './atender-alerta.use-case';

const JEFE = { idUsuario: 4, rol: 'JEFE_TURNO' };
const atencion = (comentario: string | null): AtencionAlerta => ({ usuario: 'Jefe Planta', fecha: new Date('2026-10-26T14:00:00Z'), comentario });

const crear = ({ existe = true, previas = [] as AtencionAlerta[] } = {}) => {
  const guardadas = [...previas];
  const idsCliente = new Set<string>();
  const alertaRepo = {
    listar: jest.fn(),
    contarActivas: jest.fn(),
    // Las de mantención se identifican por su estado: su turno es otro número
    turnoDeAlerta: jest.fn(async (tipo: TipoAlertaTurno, id: number) => (!existe ? null : tipo === 'MANTENCION' ? 55 : id)),
  } satisfies AlertaTurnoRepositoryPort;
  const atencionRepo = {
    registrar: jest.fn(async ({ comentario, idCliente }: { comentario: string | null; idCliente: string | null; fecha: Date | null }) => {
      guardadas.push(atencion(comentario));
      if (idCliente) idsCliente.add(idCliente);
    }),
    listar: jest.fn(async () => [...guardadas]),
    existeIdCliente: jest.fn(async (idCliente: string) => idsCliente.has(idCliente)),
  } satisfies AtencionAlertaRepositoryPort;
  const publicador = { publicar: jest.fn(), publicarAtencion: jest.fn() } satisfies PublicadorAlertasPort;
  return { alertaRepo, atencionRepo, publicador, atender: new AtenderAlertaUseCase(alertaRepo, atencionRepo, publicador) };
};

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('AtenderAlertaUseCase', () => {
  it('atiende una alerta sin comentario y avisa en tiempo real', async () => {
    const { alertaRepo, atencionRepo, publicador, atender } = crear();

    const resultado = await atender.execute({ idAlerta: 'E-12', comentario: '  ', autor: JEFE });

    expect(alertaRepo.turnoDeAlerta).toHaveBeenCalledWith('TURNO_EXTENDIDO', 12);
    expect(atencionRepo.registrar).toHaveBeenCalledWith({ idAlerta: 'E-12', idTurno: 12, idUsuario: 4, comentario: null, idCliente: null, fecha: null });
    expect(resultado.atenciones).toHaveLength(1);
    expect(publicador.publicarAtencion).toHaveBeenCalledWith({ idAlerta: 'E-12', atenciones: resultado.atenciones });
  });

  it.each([
    ['J-7', 'JORNADA_EXTENDIDA', 7],
    ['A-31', 'CIERRE_AUTOMATICO', 31],
  ])('reconoce el tipo de %s', async (idAlerta, tipo, idTurno) => {
    const { alertaRepo, atender } = crear();
    await atender.execute({ idAlerta, comentario: 'Se llamó al operador', autor: JEFE });
    expect(alertaRepo.turnoDeAlerta).toHaveBeenCalledWith(tipo, idTurno);
  });

  it('una alerta de mantención se registra en el turno de su estado', async () => {
    const { alertaRepo, atencionRepo, atender } = crear();
    await atender.execute({ idAlerta: 'M-900', comentario: 'Mecánico en camino', autor: JEFE });
    expect(alertaRepo.turnoDeAlerta).toHaveBeenCalledWith('MANTENCION', 900);
    expect(atencionRepo.registrar).toHaveBeenCalledWith(expect.objectContaining({ idAlerta: 'M-900', idTurno: 55 }));
  });

  it('una alerta ya atendida solo admite notas con comentario', async () => {
    const { atencionRepo, atender } = crear({ previas: [atencion(null)] });

    expect(await codigoDe(atender.execute({ idAlerta: 'E-12', comentario: '', autor: JEFE }))).toBe('NOTA_VACIA');
    const conNota = await atender.execute({ idAlerta: 'E-12', comentario: 'Cerró a las 23:10', autor: JEFE });

    expect(atencionRepo.registrar).toHaveBeenCalledTimes(1);
    expect(conNota.atenciones.map((a) => a.comentario)).toEqual([null, 'Cerró a las 23:10']);
  });

  it.each(['X-1', 'E-', 'E-abc', '', 'E-1; DROP TABLE turno'])('id de alerta inválido %p -> ALERTA_NO_ENCONTRADA', async (idAlerta) => {
    const { atencionRepo, atender } = crear();
    expect(await codigoDe(atender.execute({ idAlerta, comentario: null, autor: JEFE }))).toBe('ALERTA_NO_ENCONTRADA');
    expect(atencionRepo.registrar).not.toHaveBeenCalled();
  });

  it('una alerta que no existe para ese turno no se atiende', async () => {
    const { atencionRepo, atender } = crear({ existe: false });
    expect(await codigoDe(atender.execute({ idAlerta: 'A-5', comentario: null, autor: JEFE }))).toBe('ALERTA_NO_ENCONTRADA');
    expect(atencionRepo.registrar).not.toHaveBeenCalled();
  });

  it('rechaza comentarios de más de 500 caracteres', async () => {
    const { atender } = crear();
    expect(await codigoDe(atender.execute({ idAlerta: 'E-1', comentario: 'x'.repeat(501), autor: JEFE }))).toBe('COMENTARIO_LARGO');
  });

  it.each(['VISOR', 'OPERADOR'])('un %s no puede atender', async (rol) => {
    const { atender } = crear();
    expect(await codigoDe(atender.execute({ idAlerta: 'E-1', comentario: null, autor: { idUsuario: 9, rol } }))).toBe('SIN_PERMISO');
  });
  it('un reintento con el mismo idCliente no duplica la atención', async () => {
    const { atencionRepo, atender } = crear();
    const idCliente = '7b1f6a0e-2c3d-4e5f-8a9b-0c1d2e3f4a5b';

    await atender.execute({ idAlerta: 'E-12', comentario: 'Se llamó al operador', autor: JEFE, idCliente });
    const reintento = await atender.execute({ idAlerta: 'E-12', comentario: 'Se llamó al operador', autor: JEFE, idCliente: idCliente.toUpperCase() });

    expect(atencionRepo.registrar).toHaveBeenCalledTimes(1);
    expect(reintento.atenciones).toHaveLength(1);
    expect(await codigoDe(atender.execute({ idAlerta: 'E-12', comentario: 'x', autor: JEFE, idCliente: 'no-es-uuid' }))).toBe('DATOS_INVALIDOS');
  });

  it('si otro jefe la atendió entremedio, la segunda atención se acepta aunque no tenga comentario', async () => {
    const { atencionRepo, atender } = crear({ previas: [atencion(null)] });

    const resultado = await atender.execute({ idAlerta: 'E-12', comentario: '', autor: JEFE, atencionesVistas: 0 });

    expect(resultado.atenciones).toHaveLength(2);
    expect(atencionRepo.registrar).toHaveBeenCalledTimes(1);
    // Si ya la vio atendida, una nota sin comentario sigue sin aceptarse
    expect(await codigoDe(atender.execute({ idAlerta: 'E-12', comentario: '', autor: JEFE, atencionesVistas: 2 }))).toBe('NOTA_VACIA');
  });

  it('una atención hecha sin señal queda con la fecha en que se hizo; una fecha futura queda en ahora', async () => {
    const { atencionRepo, atender } = crear();
    const fecha = (llamada: number) => atencionRepo.registrar.mock.calls[llamada][0].fecha;

    await atender.execute({ idAlerta: 'E-12', comentario: 'Sin señal', autor: JEFE, fechaAccion: '2026-10-26T13:30:00.000Z' });
    await atender.execute({ idAlerta: 'E-12', comentario: 'Reloj adelantado', autor: JEFE, fechaAccion: '2999-01-01T00:00:00Z' });

    expect(fecha(0)).toEqual(new Date('2026-10-26T13:30:00.000Z'));
    expect(fecha(1)).toBeNull();
    expect(await codigoDe(atender.execute({ idAlerta: 'E-12', comentario: 'x', autor: JEFE, fechaAccion: 'ayer' }))).toBe('DATOS_INVALIDOS');
  });
});
