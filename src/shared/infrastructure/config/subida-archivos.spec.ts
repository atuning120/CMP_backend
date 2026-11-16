import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurarHttp } from './http';

/*
 * Subidas multipart (multer, dentro de @nestjs/platform-express) con el middleware HTTP real. Las usan las fotos de
 * evidencia (evidencia.controller.ts) y el Excel del estado de pago (dashboards.controller.ts), que ningún otro spec
 * sube de verdad: este cubre que una actualización de Nest/multer no rompa la subida ni el límite de tamaño.
 */

const LIMITE = 1024;

// Lo que entrega multer, igual que en los controllers (el proyecto no instala @types/multer)
interface ArchivoSubido {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Controller('subida')
class SubidaController {
  @Post()
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: LIMITE, files: 1 } }))
  subir(@UploadedFile() archivo: ArchivoSubido | undefined) {
    return archivo
      ? { nombre: archivo.originalname, mime: archivo.mimetype, tamano: archivo.size, contenido: archivo.buffer.toString('utf8') }
      : { sinArchivo: true };
  }
}

describe('subida de archivos (multer)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [SubidaController] }).compile();
    app = modulo.createNestApplication<NestExpressApplication>({ logger: false });
    configurarHttp(app, undefined, { log: jest.fn(), warn: jest.fn(), error: jest.fn() });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('recibe el archivo completo, con su nombre y tipo, junto a los otros campos del formulario', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/subida')
      .field('idCliente', 'uuid-1')
      .attach('archivo', Buffer.from('foto de prueba'), { filename: 'evidencia.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(respuesta.body).toEqual({ nombre: 'evidencia.jpg', mime: 'image/jpeg', tamano: 14, contenido: 'foto de prueba' });
  });

  it('rechaza un archivo sobre el límite con 413', async () => {
    await request(app.getHttpServer())
      .post('/subida')
      .attach('archivo', Buffer.alloc(LIMITE + 1, 'x'), { filename: 'grande.jpg', contentType: 'image/jpeg' })
      .expect(413);
  });

  it('un formulario sin archivo llega al controller sin él', async () => {
    const respuesta = await request(app.getHttpServer()).post('/subida').field('idCliente', 'uuid-1').expect(201);
    expect(respuesta.body).toEqual({ sinArchivo: true });
  });
});
