import { BadRequestException, Injectable } from '@nestjs/common';
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

// Tipos que no son DTOs: @Body('campo') llega con uno de estos, y `import type` o un tipo inline llegan como Object
const TIPOS_NATIVOS: unknown[] = [String, Boolean, Number, Array, Object];

/**
 * Validación global de tipos del cuerpo de las peticiones (class-validator). Solo revisa los DTOs con decoradores, y
 * solo el tipo de cada campo: si falta un dato o no cumple una regla, lo sigue decidiendo el use case con su propio
 * código de error (DATOS_INCOMPLETOS, ROL_INVALIDO...). Su objetivo es que un tipo inesperado (un número u objeto donde
 * va un string) responda 400 y no un 500 al chocar con .trim(), bcrypt o createHash.
 *
 * No se usa el ValidationPipe de Nest porque, con cualquier opción, devuelve una copia del cuerpo con los campos de la
 * clase agregados en undefined: un PATCH dejaría de distinguir "campo ausente" de "campo vacío". Este pipe devuelve
 * siempre el cuerpo original, sin recortar ni convertir nada, así los DTOs se pueden decorar de a poco sin romper a los
 * clientes (la app móvil manda peticiones encoladas offline). Un DTO sin decoradores pasa intacto.
 */
@Injectable()
export class ValidacionTiposPipe implements PipeTransform {
  async transform(value: unknown, { type, metatype }: ArgumentMetadata): Promise<unknown> {
    if (type !== 'body' || !metatype || TIPOS_NATIVOS.includes(metatype) || value === null || typeof value !== 'object') {
      return value;
    }

    const errores = await validate(plainToInstance(metatype, value) as object, {
      // Sin esto, class-validator rechaza entero un DTO que aún no tiene decoradores
      forbidUnknownValues: false,
      validationError: { target: false, value: false },
    });
    if (errores.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'DATOS_INVALIDOS',
        message: 'Los datos enviados no tienen el formato esperado',
        // Solo los nombres de los campos, nunca sus valores (pueden ser contraseñas o tokens)
        campos: errores.map((e) => e.property),
      });
    }
    return value;
  }
}
