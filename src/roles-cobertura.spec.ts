import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from './modules/auth/infrastructure/guards/jwt-auth.guard';
import { ROLES_KEY, RolesGuard } from './modules/auth/infrastructure/guards/roles.guard';
import { ApiKeyAdaptadorGuard } from './modules/tracking/infrastructure/guards/api-key-adaptador.guard';

/**
 * Permisos de todo el API, recorriendo todos los *.controller.ts (también los que se agreguen después):
 * - Toda ruta con JWT lleva RolesGuard y declara @Roles (sin eso RolesGuard la rechaza en producción).
 * - Una ruta sin JWT solo puede ser una de las públicas o la del adaptador (API key).
 * - La matriz de abajo fija quién puede llamar a cada endpoint: cambiar un permiso obliga a cambiarla aquí.
 */
const TODOS = 'ADMIN,JEFE_TURNO,OPERADOR,VISOR';
const GESTION = 'ADMIN,JEFE_TURNO';

const MATRIZ: Record<string, string> = {
  // Catálogos y mapa: cualquier usuario con sesión (app y panel web)
  'GET /maquinas': TODOS,
  'GET /maquinas/flota': TODOS,
  'GET /maquinas/tipos': TODOS,
  'GET /maquinas/marcas': TODOS,
  'GET /modelos-maquina': TODOS,
  'GET /estados-operacionales': TODOS,
  'GET /areas': TODOS,
  'GET /areas/:idArea/zonas': TODOS,
  'GET /zonas': TODOS,
  'GET /geocercas/mapa': TODOS,
  'GET /tracking/ultimas': TODOS,
  'GET /tracking/maquinas/:idMaquina/recorrido': TODOS,
  'GET /tracking/turnos/:idTurno/recorrido': TODOS,
  // Turno del operador (app)
  'GET /turnos/actual': 'OPERADOR',
  'POST /turnos/iniciar': 'OPERADOR',
  'POST /turnos/finalizar': 'OPERADOR',
  'POST /turnos/estados': 'OPERADOR',
  'POST /turnos/ubicacion': 'OPERADOR',
  'POST /reportes': 'OPERADOR',
  'POST /evidencias': 'OPERADOR',
  'GET /evidencias/:idCliente/archivo': 'ADMIN,JEFE_TURNO,OPERADOR',
  // Gestión de la flota (jefe de turno y administrador)
  'GET /maquinas/operadores': GESTION,
  'POST /maquinas': GESTION,
  'POST /maquinas/:id/reemplazo': GESTION,
  'POST /maquinas/:id/devolucion': GESTION,
  'PATCH /maquinas/:id': GESTION,
  'POST /turnos/maquina/:idMaquina/cierre': GESTION,
  'GET /alertas': GESTION,
  'POST /alertas/:idAlerta/atenciones': GESTION,
  'GET /historial': GESTION,
  'GET /historial/excel': GESTION,
  'GET /dashboards/cargas': GESTION,
  'POST /dashboards/cargas/previsualizar': GESTION,
  'POST /dashboards/cargas': GESTION,
  'GET /dashboards/:tipo': GESTION,
  // Administración
  'GET /usuarios': 'ADMIN',
  'POST /usuarios': 'ADMIN',
  'PATCH /usuarios/:idUsuario': 'ADMIN',
  'PATCH /usuarios/:idUsuario/activo': 'ADMIN',
  'PATCH /usuarios/:idUsuario/rol': 'ADMIN',
  'POST /geocercas/areas': 'ADMIN',
  'PUT /geocercas/areas/orden': 'ADMIN',
  'PATCH /geocercas/areas/:idArea': 'ADMIN',
  'DELETE /geocercas/areas/:idArea': 'ADMIN',
  'POST /geocercas/areas/:idArea/zonas': 'ADMIN',
  'PATCH /geocercas/zonas/:idZona': 'ADMIN',
  'DELETE /geocercas/zonas/:idZona': 'ADMIN',
};

// Sin JWT: login y sesión (con límite de intentos), sondas de salud y el adaptador (API key)
const PUBLICAS = new Set([
  'GET /',
  'GET /health',
  'POST /auth/register/admin',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/refresh/web',
  'POST /auth/logout',
  'POST /auth/login/web',
  'POST /auth/login/web/credenciales',
]);
const CON_API_KEY = new Set(['POST /tracking/posiciones']);

interface Ruta {
  clave: string;
  guards: unknown[];
  roles: string[] | undefined;
}

const archivosController = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivosController(join(dir, e.name)) : e.name.endsWith('.controller.ts') ? [join(dir, e.name)] : [],
  );

const unir = (...partes: (string | undefined)[]) =>
  '/' +
  partes
    .flatMap((p) => (p ?? '').split('/'))
    .filter(Boolean)
    .join('/');

const leerRutas = async (): Promise<Ruta[]> => {
  const rutas: Ruta[] = [];
  for (const archivo of archivosController(__dirname)) {
    const modulo = (await import(archivo)) as Record<string, unknown>;
    for (const exportado of Object.values(modulo)) {
      if (typeof exportado !== 'function' || Reflect.getMetadata(PATH_METADATA, exportado) === undefined) continue;
      const clase = exportado as new (...args: unknown[]) => object;
      const prototipo = clase.prototype as Record<string, unknown>;
      for (const nombre of Object.getOwnPropertyNames(prototipo)) {
        const handler = prototipo[nombre];
        if (nombre === 'constructor' || typeof handler !== 'function') continue;
        const metodo = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (metodo === undefined) continue;
        rutas.push({
          clave: `${RequestMethod[metodo]} ${unir(Reflect.getMetadata(PATH_METADATA, clase) as string, Reflect.getMetadata(PATH_METADATA, handler) as string)}`,
          guards: [...((Reflect.getMetadata(GUARDS_METADATA, clase) as unknown[]) ?? []), ...((Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ?? [])],
          roles: (Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, clase)) as string[] | undefined,
        });
      }
    }
  }
  return rutas;
};

describe('Permisos de las rutas del API', () => {
  let rutas: Ruta[];
  beforeAll(async () => {
    rutas = await leerRutas();
  });

  it('encuentra los controllers', () => {
    expect(rutas.length).toBeGreaterThan(50);
  });

  it('toda ruta con JWT lleva RolesGuard y declara @Roles', () => {
    const sinRoles = rutas
      .filter((r) => r.guards.includes(JwtAuthGuard))
      .filter((r) => !r.guards.includes(RolesGuard) || !r.roles?.length)
      .map((r) => r.clave);
    expect(sinRoles).toEqual([]);
  });

  it('RolesGuard va después de JwtAuthGuard (necesita req.user)', () => {
    const malOrdenadas = rutas
      .filter((r) => r.guards.includes(RolesGuard))
      .filter((r) => r.guards.indexOf(JwtAuthGuard) === -1 || r.guards.indexOf(JwtAuthGuard) > r.guards.indexOf(RolesGuard))
      .map((r) => r.clave);
    expect(malOrdenadas).toEqual([]);
  });

  it('una ruta sin JWT es pública a propósito o es del adaptador', () => {
    const abiertas = rutas
      .filter((r) => !r.guards.includes(JwtAuthGuard))
      .filter((r) => !PUBLICAS.has(r.clave) && !(CON_API_KEY.has(r.clave) && r.guards.includes(ApiKeyAdaptadorGuard)))
      .map((r) => r.clave);
    expect(abiertas).toEqual([]);
  });

  it('cada ruta con JWT tiene los roles de la matriz', () => {
    const actual = Object.fromEntries(
      rutas.filter((r) => r.guards.includes(JwtAuthGuard)).map((r) => [r.clave, [...(r.roles ?? [])].sort().join(',')]),
    );
    expect(actual).toEqual(MATRIZ);
  });
});
