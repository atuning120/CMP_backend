import type { AlertaTurnoRepositoryPort, AtencionAlerta, TipoAlertaTurno } from '../../domain/repositories/alerta-turno.repository.port';
import type { AtencionAlertaRepositoryPort } from '../../domain/repositories/atencion-alerta.repository.port';
import type { PublicadorAlertasPort } from '../ports/publicador-alertas.port';
import { AtenderAlertaUseCase } from './atender-alerta.use-case';

const JEFE = { idUsuario: 4, rol: 'JEFE_TURNO' };
const atencion = (comentario: string | null): AtencionAlerta => ({ usuario: 'Jefe Planta', fecha: new Date('2026-10-26T14:00:00Z'), comentario });

const crear = ({ existe = true, previas = [] as AtencionAlerta[] } = {}) => {
  const guardadas = [...previas];
  const alertaRepo = {
    listar: jest.fn(),
    contarExtendidosEnCurso: jest.fn(),
    existe: jest.fn(async (_tipo: TipoAlertaTurno, _idTurno: number) => existe),
  } satisfies AlertaTurnoRepositoryPort;
  const atencionRepo = {
    registrar: jest.fn(async ({ comentario }: { comentario: string | null }) => {
      guardadas.push(atencion(comentario));
    }),
    listar: jest.fn(async () => [...guardadas]),
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

    expect(alertaRepo.existe).toHaveBeenCalledWith('TURNO_EXTENDIDO', 12);
    expect(atencionRepo.registrar).toHaveBeenCalledWith({ idAlerta: 'E-12', idTurno: 12, idUsuario: 4, comentario: null });
    expect(resultado.atenciones).toHaveLength(1);
    expect(publicador.publicarAtencion).toHaveBeenCalledWith({ idAlerta: 'E-12', atenciones: resultado.atenciones });
  });

  it.each([
    ['J-7', 'JORNADA_EXTENDIDA', 7],
    ['A-31', 'CIERRE_AUTOMATICO', 31],
  ])('reconoce el tipo de %s', async (idAlerta, tipo, idTurno) => {
    const { alertaRepo, atender } = crear();
    await atender.execute({ idAlerta, comentario: 'Se llamó al operador', autor: JEFE });
    expect(alertaRepo.existe).toHaveBeenCalledWith(tipo, idTurno);
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
});
