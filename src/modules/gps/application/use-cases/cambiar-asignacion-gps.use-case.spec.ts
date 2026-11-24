import { GpsModificadoError } from '../../domain/repositories/gps.repository.port';
import type { CambioAsignacion, DispositivoGps, GpsRepositoryPort } from '../../domain/repositories/gps.repository.port';
import { CambiarAsignacionGpsUseCase } from './cambiar-asignacion-gps.use-case';

const JEFE = { rol: 'JEFE_TURNO', idUsuario: 7 };
const gps = (idGps: number, imei: string, maquina: DispositivoGps['maquina'] = null, activo = true): DispositivoGps => ({
  idGps,
  imei,
  modelo: 'JIMI_LL301',
  numeroSim: null,
  activo,
  maquina,
  asignadoDesde: null,
  ultimaPosicion: null,
});

const MAQUINAS = new Map([
  [33, 'CF-33'],
  [23, 'BD-23'],
  [5, 'EX-05'],
]);

// GPS 1 en CF-33, GPS 2 en EX-05, GPS 3 sin máquina, GPS 4 dado de baja
const crear = (guardar: (cambio: CambioAsignacion) => Promise<void> = async () => {}) => {
  const dispositivos = [
    gps(1, '864032050668829', { idMaquina: 33, nombre: 'CF-33' }),
    gps(2, '864032050668837', { idMaquina: 5, nombre: 'EX-05' }),
    gps(3, '864032050668845'),
    gps(4, '864032050668852', null, false),
  ];
  const cambiarAsignacion = jest.fn(guardar);
  const repo = {
    buscar: async (id: number) => dispositivos.find((d) => d.idGps === id) ?? null,
    deMaquina: async (id: number) => dispositivos.find((d) => d.maquina?.idMaquina === id) ?? null,
    nombreMaquina: async (id: number) => MAQUINAS.get(id) ?? null,
    cambiarAsignacion,
  } as unknown as GpsRepositoryPort;
  return { useCase: new CambiarAsignacionGpsUseCase(repo), cambiarAsignacion };
};

const codigo = async (promesa: Promise<unknown>) => {
  try {
    await promesa;
  } catch (error) {
    return ((error as { getResponse(): unknown }).getResponse() as { code: string }).code;
  }
  return null;
};

const mover = { idMaquina: 23, idMaquinaActual: 33, idGpsDesplazado: null, motivo: 'Reemplazo de máquina' };

describe('CambiarAsignacionGpsUseCase', () => {
  it('mueve el GPS a la máquina que reemplaza y lo registra en la bitácora de las dos', async () => {
    const { useCase, cambiarAsignacion } = crear();
    await useCase.asignar(JEFE, 1, { ...mover, observacion: 'Falla hidráulica' });

    expect(cambiarAsignacion).toHaveBeenCalledWith({
      idGps: 1,
      idMaquina: 23,
      idMaquinaActual: 33,
      idGpsDesplazado: null,
      acciones: [
        {
          idMaquina: 23,
          idUsuario: 7,
          motivo: 'Reemplazo de máquina',
          observacion: 'GPS 864032050668829 traído desde CF-33 · Falla hidráulica',
          detalle: { antes: { gps: null }, despues: { gps: '864032050668829' } },
        },
        {
          idMaquina: 33,
          idUsuario: 7,
          motivo: 'Reemplazo de máquina',
          observacion: 'Su GPS 864032050668829 pasó a BD-23 · Falla hidráulica',
          detalle: { antes: { gps: '864032050668829' }, despues: { gps: null } },
        },
      ],
    });
  });

  it('vincula un GPS sin máquina', async () => {
    const { useCase, cambiarAsignacion } = crear();
    await useCase.asignar(JEFE, 3, { ...mover, idMaquinaActual: null });

    expect(cambiarAsignacion.mock.calls[0][0].acciones).toEqual([
      expect.objectContaining({ idMaquina: 23, observacion: 'GPS 864032050668845 vinculado' }),
    ]);
  });

  it('si el destino tiene otro GPS pide confirmarlo, y al confirmar lo saca', async () => {
    const { useCase, cambiarAsignacion } = crear();
    const aEx05 = { ...mover, idMaquina: 5 };
    expect(await codigo(useCase.asignar(JEFE, 1, aEx05))).toBe('MAQUINA_CON_GPS');
    expect(cambiarAsignacion).not.toHaveBeenCalled();

    await useCase.asignar(JEFE, 1, { ...aEx05, idGpsDesplazado: 2 });
    const [cambio] = cambiarAsignacion.mock.calls[0];
    expect(cambio.idGpsDesplazado).toBe(2);
    expect(cambio.acciones[0]).toMatchObject({
      idMaquina: 5,
      observacion: 'GPS 864032050668829 traído desde CF-33; sale el GPS 864032050668837',
      detalle: { antes: { gps: '864032050668837' }, despues: { gps: '864032050668829' } },
    });
  });

  it('no aplica el cambio si el GPS o el destino ya no están como los vio el usuario', async () => {
    const { useCase } = crear();
    expect(await codigo(useCase.asignar(JEFE, 1, { ...mover, idMaquinaActual: 5 }))).toBe('GPS_MODIFICADO');
    expect(await codigo(useCase.asignar(JEFE, 1, { ...mover, idGpsDesplazado: 2 }))).toBe('GPS_MODIFICADO');
    expect(await codigo(useCase.desvincular(JEFE, 1, { idMaquinaActual: null, motivo: 'Otro' }))).toBe('GPS_MODIFICADO');

    // Cambió entre la validación y el guardado
    const concurrente = crear(async () => {
      throw new GpsModificadoError();
    });
    expect(await codigo(concurrente.useCase.asignar(JEFE, 1, mover))).toBe('GPS_MODIFICADO');
  });

  it('desvincula el GPS de su máquina', async () => {
    const { useCase, cambiarAsignacion } = crear();
    await useCase.desvincular(JEFE, 1, { idMaquinaActual: 33, motivo: 'Equipo GPS con falla' });

    expect(cambiarAsignacion).toHaveBeenCalledWith(
      expect.objectContaining({
        idMaquina: null,
        idMaquinaActual: 33,
        acciones: [expect.objectContaining({ idMaquina: 33, observacion: 'GPS 864032050668829 desvinculado' })],
      }),
    );
    expect(await codigo(useCase.desvincular(JEFE, 3, { idMaquinaActual: null, motivo: 'Otro' }))).toBe('GPS_SIN_MAQUINA');
  });

  it.each([
    ['rol sin permiso', { rol: 'VISOR', idUsuario: 7 }, 1, mover, 'SIN_PERMISO'],
    ['GPS inexistente', JEFE, 99, mover, 'GPS_NO_ENCONTRADO'],
    ['GPS dado de baja', JEFE, 4, { ...mover, idMaquinaActual: null }, 'GPS_INACTIVO'],
    ['máquina inexistente', JEFE, 1, { ...mover, idMaquina: 999 }, 'MAQUINA_NO_ENCONTRADA'],
    ['misma máquina', JEFE, 1, { ...mover, idMaquina: 33 }, 'SIN_CAMBIOS'],
    ['sin máquina', JEFE, 1, { ...mover, idMaquina: null }, 'DATOS_INVALIDOS'],
    ['sin motivo', JEFE, 1, { ...mover, motivo: '  ' }, 'DATOS_INVALIDOS'],
    ['sin decir qué vio', JEFE, 1, { idMaquina: 23, motivo: 'Otro' }, 'DATOS_INVALIDOS'],
  ])('rechaza: %s', async (_caso, autor, id, dto, esperado) => {
    expect(await codigo(crear().useCase.asignar(autor, id, dto))).toBe(esperado);
  });
});
