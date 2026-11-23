import type { VersionApp, VersionAppRepositoryPort } from '../../domain/repositories/version-app.repository.port';
import type { AlmacenamientoApkPort } from '../../domain/ports/almacenamiento-apk.port';
import { compararVersiones } from '../../domain/numero-version';
import { ListarVersionesUseCase } from './listar-versiones.use-case';
import { ObtenerDescargaUseCase } from './obtener-descarga.use-case';
import { PrepararSubidaUseCase } from './preparar-subida.use-case';
import { RegistrarVersionUseCase } from './registrar-version.use-case';
import { EditarVersionUseCase } from './editar-version.use-case';
import { EliminarVersionUseCase } from './eliminar-version.use-case';

const AHORA = new Date('2026-11-19T12:00:00Z');
const APK = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// VERSION_APP en memoria, con el mismo orden y unicidad que la tabla
class VersionesEnMemoria implements VersionAppRepositoryPort {
  filas: VersionApp[] = [];
  private siguiente = 1;

  agregar(version: string, publicada = true) {
    const fila: VersionApp = {
      idVersion: this.siguiente++,
      version,
      notas: `Notas ${version}`,
      archivo: `geoplanta-movil-${version}-0000000${this.siguiente}.apk`,
      tamanoBytes: 80_000_000,
      publicada,
      subidaEn: AHORA,
      subidaPor: 'Administrador 1',
    };
    this.filas.push(fila);
    return fila;
  }

  listar(soloPublicadas: boolean) {
    return Promise.resolve(this.filas.filter((f) => f.publicada || !soloPublicadas).sort((a, b) => compararVersiones(b.version, a.version)));
  }
  buscar(idVersion: number) {
    return Promise.resolve(this.filas.find((f) => f.idVersion === idVersion) ?? null);
  }
  existeVersion(version: string) {
    return Promise.resolve(this.filas.some((f) => f.version === version));
  }
  crear(datos: { version: string; notas: string; archivo: string; tamanoBytes: number }) {
    if (this.filas.some((f) => f.version === datos.version)) return Promise.resolve(null);
    const fila = this.agregar(datos.version);
    Object.assign(fila, { notas: datos.notas, archivo: datos.archivo, tamanoBytes: datos.tamanoBytes });
    return Promise.resolve(fila);
  }
  actualizar(idVersion: number, cambios: { notas?: string; publicada?: boolean }) {
    const fila = this.filas.find((f) => f.idVersion === idVersion);
    if (fila) Object.assign(fila, cambios);
    return Promise.resolve(fila ?? null);
  }
  eliminar(idVersion: number) {
    const fila = this.filas.find((f) => f.idVersion === idVersion) ?? null;
    this.filas = this.filas.filter((f) => f !== fila);
    return Promise.resolve(fila);
  }
}

const almacenamiento = (subido: { tamanoBytes: number; cabecera: Buffer } | null = { tamanoBytes: 80_000_000, cabecera: APK }) => {
  const eliminar = jest.fn().mockResolvedValue(undefined);
  const urlDescarga = jest.fn((archivo: string, nombre: string) => Promise.resolve(`https://blob/${archivo}?r&${nombre}`));
  const port: AlmacenamientoApkPort = {
    urlSubida: (archivo) => Promise.resolve(`https://blob/${archivo}?cw`),
    urlDescarga,
    inspeccionar: () => Promise.resolve(subido),
    eliminar,
  };
  return { port, eliminar, urlDescarga };
};

const codigoDe = async (promesa: Promise<unknown>) => {
  try {
    await promesa;
  } catch (error) {
    return (error as { getResponse(): { code: string } }).getResponse().code;
  }
  throw new Error('No lanzó error');
};

describe('Versiones de la app', () => {
  let versiones: VersionesEnMemoria;
  beforeEach(() => {
    versiones = new VersionesEnMemoria();
  });

  describe('ListarVersiones', () => {
    it('la página pública ve solo las publicadas, de la más alta a la más baja y sin datos internos', async () => {
      versiones.agregar('1.9.0');
      versiones.agregar('1.10.0');
      versiones.agregar('1.10.1', false);
      const publicas = await new ListarVersionesUseCase(versiones).publicas();
      expect(publicas.map((v) => v.version)).toEqual(['1.10.0', '1.9.0']);
      expect(publicas[0]).not.toHaveProperty('archivo');
      expect(publicas[0]).not.toHaveProperty('subidaPor');
    });

    it('el administrador ve también las retiradas; otro rol no', async () => {
      versiones.agregar('1.0.0');
      versiones.agregar('1.0.1', false);
      expect((await new ListarVersionesUseCase(versiones).todas('ADMIN')).map((v) => v.version)).toEqual(['1.0.1', '1.0.0']);
      expect(await codigoDe(new ListarVersionesUseCase(versiones).todas('JEFE_TURNO'))).toBe('SIN_PERMISO');
    });
  });

  describe('ObtenerDescarga', () => {
    it('la última es la versión publicada más alta, con un enlace de 10 minutos y nombre legible', async () => {
      versiones.agregar('1.2.0');
      const alta = versiones.agregar('1.3.0');
      versiones.agregar('1.4.0', false);
      const { port, urlDescarga } = almacenamiento();
      await new ObtenerDescargaUseCase(versiones, port).execute('ultima', AHORA);
      expect(urlDescarga).toHaveBeenCalledWith(alta.archivo, 'geoplanta-movil-1.3.0.apk', new Date(AHORA.getTime() + 10 * 60_000));
    });

    it('una versión retirada o inexistente no se descarga', async () => {
      const retirada = versiones.agregar('1.0.0', false);
      const { port } = almacenamiento();
      expect(await codigoDe(new ObtenerDescargaUseCase(versiones, port).execute(retirada.idVersion))).toBe('VERSION_NO_ENCONTRADA');
      expect(await codigoDe(new ObtenerDescargaUseCase(versiones, port).execute(99))).toBe('VERSION_NO_ENCONTRADA');
      expect(await codigoDe(new ObtenerDescargaUseCase(versiones, port).execute('ultima'))).toBe('APK_NO_PUBLICADA');
    });

    it('sin almacenamiento configurado responde DESCARGA_NO_CONFIGURADA', async () => {
      versiones.agregar('1.0.0');
      expect(await codigoDe(new ObtenerDescargaUseCase(versiones, null).execute('ultima'))).toBe('DESCARGA_NO_CONFIGURADA');
    });
  });

  describe('PrepararSubida', () => {
    it('entrega un archivo con la versión y un sufijo al azar, y un enlace de subida', async () => {
      const subida = await new PrepararSubidaUseCase(versiones, almacenamiento().port).execute(
        { rol: 'ADMIN', version: '1.4.0', tamanoBytes: 80_000_000 },
        AHORA,
      );
      expect(subida.archivo).toMatch(/^geoplanta-movil-1\.4\.0-[0-9a-f]{8}\.apk$/);
      expect(subida.urlSubida).toBe(`https://blob/${subida.archivo}?cw`);
      expect(subida.expiraEn).toEqual(new Date(AHORA.getTime() + 30 * 60_000));
    });

    it('valida rol, formato de versión, tamaño y que la versión no exista', async () => {
      versiones.agregar('1.4.0');
      const caso = new PrepararSubidaUseCase(versiones, almacenamiento().port);
      expect(await codigoDe(caso.execute({ rol: 'JEFE_TURNO', version: '1.5.0', tamanoBytes: 1 }))).toBe('SIN_PERMISO');
      expect(await codigoDe(caso.execute({ rol: 'ADMIN', version: '1.5', tamanoBytes: 1 }))).toBe('VERSION_INVALIDA');
      expect(await codigoDe(caso.execute({ rol: 'ADMIN', version: 'v1.5.0', tamanoBytes: 1 }))).toBe('VERSION_INVALIDA');
      expect(await codigoDe(caso.execute({ rol: 'ADMIN', version: '1.5.0', tamanoBytes: 0 }))).toBe('ARCHIVO_INVALIDO');
      expect(await codigoDe(caso.execute({ rol: 'ADMIN', version: '1.5.0', tamanoBytes: 400 * 1024 * 1024 }))).toBe('ARCHIVO_INVALIDO');
      expect(await codigoDe(caso.execute({ rol: 'ADMIN', version: '1.4.0', tamanoBytes: 1 }))).toBe('VERSION_EXISTENTE');
    });
  });

  describe('RegistrarVersion', () => {
    const datos = { rol: 'ADMIN', idUsuario: 1, version: '1.4.0', notas: '  Mejoras en el cierre de turno  ', archivo: 'geoplanta-movil-1.4.0-a1b2c3d4.apk' };

    it('registra la versión publicada con el tamaño real del archivo y las notas sin espacios de más', async () => {
      const creada = await new RegistrarVersionUseCase(versiones, almacenamiento({ tamanoBytes: 81_234_567, cabecera: APK }).port).execute(datos);
      expect(creada).toMatchObject({ version: '1.4.0', notas: 'Mejoras en el cierre de turno', tamanoBytes: 81_234_567, publicada: true });
    });

    it('rechaza un archivo que no es de esta subida, que no llegó o que no es un .apk (y lo borra)', async () => {
      expect(await codigoDe(new RegistrarVersionUseCase(versiones, almacenamiento().port).execute({ ...datos, archivo: 'otro.apk' }))).toBe('ARCHIVO_INVALIDO');
      expect(await codigoDe(new RegistrarVersionUseCase(versiones, almacenamiento(null).port).execute(datos))).toBe('ARCHIVO_NO_SUBIDO');

      const { port, eliminar } = almacenamiento({ tamanoBytes: 10, cabecera: Buffer.from('%PDF') });
      expect(await codigoDe(new RegistrarVersionUseCase(versiones, port).execute(datos))).toBe('ARCHIVO_INVALIDO');
      expect(eliminar).toHaveBeenCalledWith(datos.archivo);
      expect(versiones.filas).toHaveLength(0);
    });

    it('si la versión se ocupó entre medio, borra el archivo subido', async () => {
      versiones.agregar('1.4.0');
      const { port, eliminar } = almacenamiento();
      expect(await codigoDe(new RegistrarVersionUseCase(versiones, port).execute(datos))).toBe('VERSION_EXISTENTE');
      expect(eliminar).toHaveBeenCalledWith(datos.archivo);
    });

    it('limita las notas y exige ADMIN', async () => {
      expect(await codigoDe(new RegistrarVersionUseCase(versiones, almacenamiento().port).execute({ ...datos, notas: 'x'.repeat(2001) }))).toBe('NOTAS_INVALIDAS');
      expect(await codigoDe(new RegistrarVersionUseCase(versiones, almacenamiento().port).execute({ ...datos, rol: 'VISOR' }))).toBe('SIN_PERMISO');
    });
  });

  describe('EditarVersion y EliminarVersion', () => {
    it('retira, vuelve a publicar y cambia las notas', async () => {
      const v = versiones.agregar('1.0.0');
      const caso = new EditarVersionUseCase(versiones);
      expect((await caso.execute({ rol: 'ADMIN', idVersion: v.idVersion, publicada: false })).publicada).toBe(false);
      expect(await caso.execute({ rol: 'ADMIN', idVersion: v.idVersion, publicada: true, notas: ' Nuevas notas ' })).toMatchObject({
        publicada: true,
        notas: 'Nuevas notas',
      });
      expect(await codigoDe(caso.execute({ rol: 'ADMIN', idVersion: 99, publicada: false }))).toBe('VERSION_NO_ENCONTRADA');
    });

    it('elimina la fila y su archivo; aunque falle borrar el archivo, la versión ya no está', async () => {
      const v = versiones.agregar('1.0.0');
      const { port, eliminar } = almacenamiento();
      eliminar.mockRejectedValueOnce(new Error('Azure caído'));
      await new EliminarVersionUseCase(versiones, port).execute({ rol: 'ADMIN', idVersion: v.idVersion });
      expect(eliminar).toHaveBeenCalledWith(v.archivo);
      expect(versiones.filas).toHaveLength(0);
      expect(await codigoDe(new EliminarVersionUseCase(versiones, port).execute({ rol: 'ADMIN', idVersion: v.idVersion }))).toBe('VERSION_NO_ENCONTRADA');
    });
  });
});
