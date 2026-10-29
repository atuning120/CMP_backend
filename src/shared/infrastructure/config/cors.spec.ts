import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { opcionesCors } from './cors';

const opcionesPara = (origenesWeb: string | undefined, origin?: string) =>
  new Promise<CorsOptions>((resolve) => opcionesCors(origenesWeb)({ headers: { origin } }, (_, opciones) => resolve(opciones!)));

describe('opcionesCors', () => {
  const WEB = 'https://cmp-frontend.ejemplo.io';

  it('el panel web puede enviar credenciales (la cookie de sesión)', async () => {
    await expect(opcionesPara(`${WEB}/, http://localhost:5173`, WEB)).resolves.toMatchObject({ origin: WEB, credentials: true });
  });

  it('otro origen se acepta sin credenciales', async () => {
    const opciones = await opcionesPara(WEB, 'https://otra-app.ejemplo.io');
    expect(opciones).toMatchObject({ origin: '*' });
    expect(opciones.credentials).toBeUndefined();
  });

  it('sin WEB_ORIGENES solo se confía en el Frontend local', async () => {
    await expect(opcionesPara(undefined, 'http://localhost:5173')).resolves.toMatchObject({ credentials: true });
    await expect(opcionesPara(undefined, WEB)).resolves.toMatchObject({ origin: '*' });
  });

  it('expone Content-Disposition para el nombre de los Excel', async () => {
    await expect(opcionesPara(WEB)).resolves.toMatchObject({ exposedHeaders: ['Content-Disposition'] });
  });
});
