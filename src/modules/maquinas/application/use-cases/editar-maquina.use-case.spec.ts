import { MaquinaModificadaError } from '../../domain/repositories/maquina.repository.port';
import type { MaquinaFlota, MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../../domain/repositories/modelo-maquina.repository.port';
import { EditarMaquinaUseCase } from './editar-maquina.use-case';

const maquina: MaquinaFlota = {
  idMaquina: 3,
  nombre: 'CF-03',
  marca: 'Komatsu',
  modelo: 'WA600-8',
  tipoMaquina: 'Cargador Frontal',
  estado: 'ACTIVA',
  patente: 'AB-CD-12',
  anio: 2020,
  numeroChasis: null,
  esContratista: false,
  operadorAsignado: null,
  motivoEstado: null,
  operadorActual: null,
  estadoOperacional: null,
  ubicacionActual: null,
  idAreaActual: null,
  idZonaActual: null,
  horometroActual: 1500,
  regresoEstimado: null,
  respaldo: null,
  cubreA: null,
  version: 1,
  actualizadoEn: null,
  actualizadoPor: null,
};

const crear = (opciones: { nombres?: string[]; patentes?: string[]; enUso?: boolean; tipos?: string[] } = {}) => {
  const maquinaRepo = {
    findById: jest.fn(),
    findActivas: jest.fn(),
    findFlota: jest.fn(),
    findFlotaById: jest.fn(async (id: number) => (id === maquina.idMaquina ? maquina : null)),
    findIdPorIdCliente: jest.fn(async (_idCliente: string): Promise<number | null> => null),
    existeAccionDeCliente: jest.fn(async (_idCliente: string) => false),
    existeNombre: jest.fn(async (nombre: string) => (opciones.nombres ?? []).includes(nombre)),
    existePatente: jest.fn(async (patente: string) => (opciones.patentes ?? []).includes(patente)),
    tieneTurnoEnCurso: jest.fn(async () => opciones.enUso ?? false),
    create: jest.fn(),
    actualizar: jest.fn(async () => undefined),
    findTipos: jest.fn(async () => opciones.tipos ?? ['Cargador Frontal']),
    findOperadoresAsignables: jest.fn(async () => []),
    findOperadorAsignable: jest.fn(async () => null),
    reemplazar: jest.fn(async () => 0),
    devolver: jest.fn(async () => undefined),
    findMarcas: jest.fn(async () => ['Komatsu']),
  } satisfies MaquinaRepositoryPort;
  const modeloRepo = {
    findActivos: jest.fn(),
    crearSiNoExiste: jest.fn(async () => undefined),
  } satisfies ModeloMaquinaRepositoryPort;
  return { maquinaRepo, modeloRepo, editar: new EditarMaquinaUseCase(maquinaRepo, modeloRepo) };
};

const base = { rol: 'JEFE_TURNO', idUsuario: 7, idMaquina: '3', motivo: 'Corrección de datos' };
const registro = { idUsuario: 7, motivo: 'Corrección de datos', observacion: null };

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('EditarMaquinaUseCase', () => {
  it('guarda solo los campos que cambian y deja el antes/después en la bitácora', async () => {
    const { maquinaRepo, editar } = crear();
    await editar.execute({ ...base, nombre: ' cf-03 ', patente: 'zz-yy-99', numeroChasis: ' VIN123 ', anio: 2020 });
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, 1, { patente: 'ZZ-YY-99', numeroChasis: 'VIN123' }, [
      {
        ...registro,
        accion: 'EDITAR',
        detalle: { antes: { patente: 'AB-CD-12', numeroChasis: null }, despues: { patente: 'ZZ-YY-99', numeroChasis: 'VIN123' } },
      },
    ]);
    // El código no cambió (solo mayúsculas y espacios): no se revisa duplicado
    expect(maquinaRepo.existeNombre).not.toHaveBeenCalled();
    expect(maquinaRepo.existePatente).toHaveBeenCalledWith('ZZ-YY-99', 3);
  });

  it('un cambio de estado se registra como habilitar, deshabilitar o cambiar estado', async () => {
    const { maquinaRepo, editar } = crear();
    await editar.execute({ ...base, estado: 'BAJA' });
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, 1, { estado: 'BAJA' }, [
      { ...registro, accion: 'DESHABILITAR', detalle: { antes: { estado: 'ACTIVA' }, despues: { estado: 'BAJA' } } },
    ]);
    await editar.execute({ ...base, estado: 'EN_MANTENIMIENTO' });
    expect(maquinaRepo.actualizar).toHaveBeenLastCalledWith(3, 1, { estado: 'EN_MANTENIMIENTO' }, [
      { ...registro, accion: 'CAMBIAR_ESTADO', detalle: { antes: { estado: 'ACTIVA' }, despues: { estado: 'EN_MANTENIMIENTO' } } },
    ]);
    expect(await codigoDe(editar.execute({ ...base, estado: 'SIN_OPERADOR' }))).toBe('DATOS_INVALIDOS');
  });

  it('un cambio solo de estado no consulta catálogos y relee la máquina para entregar su nueva versión', async () => {
    const { maquinaRepo, editar } = crear();
    maquinaRepo.findFlotaById.mockResolvedValueOnce(maquina).mockResolvedValueOnce({ ...maquina, estado: 'EN_RESERVA', version: 2 });
    const resultado = await editar.execute({ ...base, estado: 'EN_RESERVA', observacion: 'Respaldo del turno B' });
    expect(maquinaRepo.findMarcas).not.toHaveBeenCalled();
    expect(maquinaRepo.findTipos).not.toHaveBeenCalled();
    expect(maquinaRepo.findFlotaById).toHaveBeenCalledTimes(2);
    expect(resultado).toMatchObject({ estado: 'EN_RESERVA', version: 2 });
  });

  it('no pisa un cambio que otro jefe de turno hizo después de que se vio la máquina', async () => {
    const { maquinaRepo, editar } = crear();
    maquinaRepo.findFlotaById.mockResolvedValue({ ...maquina, version: 4, actualizadoPor: 'Juan Pérez' });

    const error = await editar.execute({ ...base, estado: 'EN_RESERVA', versionBase: 3 }).catch((e: any) => e.getResponse());

    expect(error).toMatchObject({ code: 'MAQUINA_MODIFICADA', message: expect.stringContaining('CF-03 fue modificada por Juan Pérez') });
    expect(maquinaRepo.actualizar).not.toHaveBeenCalled();
    expect(await codigoDe(editar.execute({ ...base, estado: 'EN_RESERVA', versionBase: '4' }))).toBe('DATOS_INVALIDOS');
    await editar.execute({ ...base, estado: 'EN_RESERVA', versionBase: 4 });
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, 4, { estado: 'EN_RESERVA' }, expect.any(Array));
  });

  it('con versión vieja, un cambio de ficha se aplica si nadie tocó esos mismos campos', async () => {
    const { maquinaRepo, editar } = crear();
    // Otro jefe de turno cambió el año (2019 -> 2020) mientras este corregía la patente
    maquinaRepo.findFlotaById.mockResolvedValue({ ...maquina, version: 4, actualizadoPor: 'Juan Pérez' });

    await editar.execute({ ...base, patente: 'ZZ-11-22', versionBase: 3, valoresBase: { patente: 'ab-cd-12' } });

    // Se guarda sobre la versión actual y solo con el campo que este cambió
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, 4, { patente: 'ZZ-11-22' }, expect.any(Array));
  });

  it('con versión vieja, si otro cambió el mismo campo es conflicto y dice cuál', async () => {
    const { maquinaRepo, editar } = crear();
    maquinaRepo.findFlotaById.mockResolvedValue({ ...maquina, version: 4, actualizadoPor: 'Juan Pérez' });

    const error = await editar
      .execute({ ...base, patente: 'ZZ-11-22', anio: 2021, versionBase: 3, valoresBase: { patente: 'XX-00-00', anio: 2019 } })
      .catch((e: any) => e.getResponse());

    expect(error).toMatchObject({
      code: 'MAQUINA_MODIFICADA',
      message: expect.stringContaining('CF-03 fue modificada por Juan Pérez (cambió el año y la patente)'),
    });
    // Sin el valor que vio de un campo que cambia, tampoco se combina
    expect(await codigoDe(editar.execute({ ...base, patente: 'ZZ-11-22', versionBase: 3, valoresBase: {} }))).toBe('MAQUINA_MODIFICADA');
    expect(maquinaRepo.actualizar).not.toHaveBeenCalled();
  });

  it('con versión vieja, el estado no se combina aunque venga valoresBase', async () => {
    const { maquinaRepo, editar } = crear();
    maquinaRepo.findFlotaById.mockResolvedValue({ ...maquina, version: 4 });
    const cambio = { ...base, estado: 'EN_RESERVA', versionBase: 3, valoresBase: { estado: 'ACTIVA' } };
    expect(await codigoDe(editar.execute(cambio))).toBe('MAQUINA_MODIFICADA');
    expect(maquinaRepo.actualizar).not.toHaveBeenCalled();
  });

  it('un reintento con el mismo idCliente no repite la edición', async () => {
    const { maquinaRepo, editar } = crear();
    const idCliente = '7b1f6a0e-2c3d-4e5f-8a9b-0c1d2e3f4a5b';

    await editar.execute({ ...base, estado: 'EN_RESERVA', versionBase: 1, idCliente });
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, 1, { estado: 'EN_RESERVA' }, [expect.objectContaining({ idCliente })]);

    // La respuesta no llegó y la app reenvía: ya está en la bitácora, se responde sin aplicarla otra vez
    maquinaRepo.existeAccionDeCliente.mockResolvedValue(true);
    maquinaRepo.findFlotaById.mockResolvedValue({ ...maquina, estado: 'EN_RESERVA', version: 2 });
    await expect(editar.execute({ ...base, estado: 'EN_RESERVA', versionBase: 1, idCliente })).resolves.toMatchObject({ version: 2 });
    expect(maquinaRepo.actualizar).toHaveBeenCalledTimes(1);
    expect(await codigoDe(editar.execute({ ...base, estado: 'EN_RESERVA', idCliente: 'x' }))).toBe('DATOS_INVALIDOS');
  });

  it('si otro jefe movió al operador que se asigna, es conflicto', async () => {
    const { maquinaRepo, editar } = crear();
    const juan = { idOperador: 4, nombre: 'Juan Pérez', rut: '1-9', maquinaAsignada: { idMaquina: 7, nombre: 'CF-07' } };
    maquinaRepo.findOperadorAsignable.mockResolvedValue(juan as never);

    // Lo vio en CF-02 y ahora está en CF-07
    const error = await editar.execute({ ...base, idOperador: 4, valoresBase: { maquinaOperador: 2 } }).catch((e: any) => e.getResponse());
    expect(error).toMatchObject({ code: 'MAQUINA_MODIFICADA', message: expect.stringContaining('Juan Pérez fue asignado a CF-07') });
    expect(maquinaRepo.actualizar).not.toHaveBeenCalled();

    // Si sigue donde lo vio, se mueve
    await editar.execute({ ...base, idOperador: 4, valoresBase: { maquinaOperador: 7 } });
    expect(maquinaRepo.actualizar).toHaveBeenCalledTimes(1);
  });

  it('si otra acción se guarda entre la validación y el guardado, tampoco la pisa', async () => {
    const { maquinaRepo, editar } = crear();
    maquinaRepo.actualizar.mockRejectedValueOnce(new MaquinaModificadaError(3));
    expect(await codigoDe(editar.execute({ ...base, estado: 'EN_RESERVA' }))).toBe('MAQUINA_MODIFICADA');
  });

  it('pasar a un estado distinto de fuera de servicio no se bloquea por un turno en curso', async () => {
    const { maquinaRepo, editar } = crear();
    maquinaRepo.tieneTurnoEnCurso.mockResolvedValue(true);
    await editar.execute({ ...base, estado: 'BAJO_OBSERVACION' });
    expect(maquinaRepo.actualizar).toHaveBeenCalled();
    expect(await codigoDe(editar.execute({ ...base, estado: 'BAJA' }))).toBe('MAQUINA_EN_USO');
  });

  it('editar y cambiar el estado a la vez deja ambos registros', async () => {
    const { maquinaRepo, editar } = crear();
    await editar.execute({ ...base, esContratista: true, estado: 'BAJA' });
    const [, , cambios, acciones] = maquinaRepo.actualizar.mock.calls[0] as unknown as [number, number, object, { accion: string }[]];
    expect(cambios).toEqual({ esContratista: true, estado: 'BAJA' });
    expect(acciones.map((a) => a.accion)).toEqual(['EDITAR', 'DESHABILITAR']);
  });

  it('valida permisos, existencia, motivo y que haya cambios', async () => {
    const { maquinaRepo, editar } = crear();
    expect(await codigoDe(editar.execute({ ...base, rol: 'OPERADOR' }))).toBe('SIN_PERMISO');
    expect(await codigoDe(editar.execute({ ...base, idMaquina: '99', nombre: 'X' }))).toBe('MAQUINA_NO_ENCONTRADA');
    expect(await codigoDe(editar.execute({ ...base, idMaquina: 'abc' }))).toBe('MAQUINA_NO_ENCONTRADA');
    expect(await codigoDe(editar.execute({ ...base, motivo: ' ', patente: 'X' }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(editar.execute({ ...base, nombre: '' }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(editar.execute({ ...base, estado: 'ROTA' }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(editar.execute({ ...base, anio: 1800 }))).toBe('ANIO_INVALIDO');
    expect(await codigoDe(editar.execute({ ...base, nombre: 'CF-03', marca: 'komatsu' }))).toBe('SIN_CAMBIOS');
    expect(maquinaRepo.actualizar).not.toHaveBeenCalled();
  });

  it('no permite repetir código ni patente de otra máquina', async () => {
    const { editar } = crear({ nombres: ['CF-04'], patentes: ['XX-11-22'] });
    expect(await codigoDe(editar.execute({ ...base, nombre: 'cf-04' }))).toBe('CODIGO_DUPLICADO');
    expect(await codigoDe(editar.execute({ ...base, patente: 'xx-11-22' }))).toBe('PATENTE_DUPLICADA');
  });

  it('no deja fuera de servicio una máquina con turno en curso', async () => {
    const { maquinaRepo, editar } = crear({ enUso: true });
    expect(await codigoDe(editar.execute({ ...base, estado: 'BAJA' }))).toBe('MAQUINA_EN_USO');
    // Editar otros datos sí se puede
    await editar.execute({ ...base, anio: 2021 });
    expect(maquinaRepo.actualizar).toHaveBeenCalledTimes(1);
  });

  it('un tipo nuevo queda registrado como modelo', async () => {
    const { modeloRepo, editar } = crear();
    await editar.execute({ ...base, tipoMaquina: 'Pala Hidráulica' });
    expect(modeloRepo.crearSiNoExiste).toHaveBeenCalledWith({
      nombre: 'Pala Hidráulica Komatsu WA600-8',
      marca: 'Komatsu',
      modelo: 'WA600-8',
      tipoMaquina: 'Pala Hidráulica',
    });
  });

  it('cambia el operador asignado y lo deja por nombre en la bitácora', async () => {
    const { maquinaRepo, editar } = crear();
    maquinaRepo.findFlotaById.mockResolvedValueOnce({ ...maquina, operadorAsignado: { idOperador: 1, nombre: 'Ana Soto' } });
    maquinaRepo.findOperadorAsignable.mockResolvedValueOnce({
      idOperador: 4,
      nombre: 'Juan Pérez',
      rut: '1-9',
      maquinaAsignada: { idMaquina: 2, nombre: 'CF-02' },
    } as never);
    await editar.execute({ ...base, idOperador: 4 });
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, 1, { idOperador: 4 }, [
      { ...registro, accion: 'EDITAR', detalle: { antes: { operador: 'Ana Soto' }, despues: { operador: 'Juan Pérez' } } },
      expect.objectContaining({ idMaquina: 2, observacion: 'Juan Pérez pasó a CF-03' }),
    ]);
  });

  it('quitar el operador o enviar el mismo', async () => {
    const { maquinaRepo, editar } = crear();
    maquinaRepo.findFlotaById.mockResolvedValue({ ...maquina, operadorAsignado: { idOperador: 1, nombre: 'Ana Soto' } });
    expect(await codigoDe(editar.execute({ ...base, idOperador: 1 }))).toBe('SIN_CAMBIOS');
    expect(maquinaRepo.findOperadorAsignable).not.toHaveBeenCalled();
    await editar.execute({ ...base, idOperador: null });
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, 1, { idOperador: null }, [
      { ...registro, accion: 'EDITAR', detalle: { antes: { operador: 'Ana Soto' }, despues: { operador: null } } },
    ]);
  });

  it.each(['EN_MANTENIMIENTO', 'EN_RESERVA', 'BAJA'])('no pasa a %s una máquina con turno en curso', async (estado) => {
    const { maquinaRepo, editar } = crear({ enUso: true });
    expect(await codigoDe(editar.execute({ ...base, estado }))).toBe('MAQUINA_EN_USO');
    expect(maquinaRepo.actualizar).not.toHaveBeenCalled();
  });

  it('bajo observación sigue operando: se puede marcar con un turno en curso', async () => {
    const { maquinaRepo, editar } = crear({ enUso: true });
    await editar.execute({ ...base, estado: 'BAJO_OBSERVACION' });
    expect(maquinaRepo.actualizar).toHaveBeenCalled();
  });

  it('en mantenimiento guarda la fecha estimada de regreso y la deja en la bitácora', async () => {
    const { maquinaRepo, editar } = crear();
    const regreso = new Date(Date.now() + 40 * 3600_000);
    await editar.execute({ ...base, estado: 'EN_MANTENIMIENTO', regresoEstimado: regreso.toISOString() });
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, 1, { estado: 'EN_MANTENIMIENTO', regresoEstimado: regreso }, [
      {
        ...registro,
        accion: 'CAMBIAR_ESTADO',
        detalle: { antes: { estado: 'ACTIVA' }, despues: { estado: 'EN_MANTENIMIENTO', regresoEstimado: regreso.toISOString() } },
      },
    ]);
  });

  it('valida la fecha de regreso: futura, de menos de un año y solo fuera de operación', async () => {
    const { editar } = crear();
    const pasada = new Date(Date.now() - 3600_000).toISOString();
    const lejana = new Date(Date.now() + 400 * 24 * 3600_000).toISOString();
    expect(await codigoDe(editar.execute({ ...base, estado: 'EN_MANTENIMIENTO', regresoEstimado: pasada }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(editar.execute({ ...base, estado: 'EN_MANTENIMIENTO', regresoEstimado: lejana }))).toBe('DATOS_INVALIDOS');
    expect(await codigoDe(editar.execute({ ...base, estado: 'EN_MANTENIMIENTO', regresoEstimado: 'mañana' }))).toBe('DATOS_INVALIDOS');
    const futura = new Date(Date.now() + 3600_000).toISOString();
    expect(await codigoDe(editar.execute({ ...base, estado: 'EN_RESERVA', regresoEstimado: futura }))).toBe('DATOS_INVALIDOS');
  });

  it('reprogramar el regreso sin cambiar de estado queda como edición', async () => {
    const { maquinaRepo, editar } = crear();
    const antes = new Date(Date.now() + 10 * 3600_000);
    const despues = new Date(Date.now() + 30 * 3600_000);
    maquinaRepo.findFlotaById.mockResolvedValue({ ...maquina, estado: 'EN_MANTENIMIENTO', regresoEstimado: antes });
    await editar.execute({ ...base, regresoEstimado: despues.toISOString() });
    expect(maquinaRepo.actualizar).toHaveBeenCalledWith(3, 1, { regresoEstimado: despues }, [
      {
        ...registro,
        accion: 'EDITAR',
        detalle: { antes: { regresoEstimado: antes.toISOString() }, despues: { regresoEstimado: despues.toISOString() } },
      },
    ]);
  });
});
