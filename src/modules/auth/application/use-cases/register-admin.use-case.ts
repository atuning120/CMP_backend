import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { exigirPasswordSegura } from '../password-segura';
import { createHash, timingSafeEqual } from 'crypto';
import { USUARIO_REPOSITORY } from '../../../usuarios/domain/repositories/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { RegisterAdminRequestDto } from '../../interface/http/dtos/register-admin.request.dto';

// Compara por hash para que el tiempo no dependa del largo ni del contenido de la clave recibida
const clavesIguales = (recibida: string, esperada: string) =>
  timingSafeEqual(
    createHash('sha256').update(recibida).digest(),
    createHash('sha256').update(esperada).digest(),
  );

/**
 * Crea un usuario ADMIN. Un admin tiene acceso total, así que el endpoint exige la clave
 * ADMIN_SETUP_KEY en el header x-admin-setup-key; sin esa variable de entorno queda deshabilitado.
 */
@Injectable()
export class RegisterAdminUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepositoryPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(dto: RegisterAdminRequestDto, claveSetup?: string): Promise<{ message: string; idUsuario: number }> {
    const claveEsperada = this.configService.get<string>('ADMIN_SETUP_KEY')?.trim();
    if (!claveEsperada) {
      // Se responde como si la ruta no existiera
      throw new NotFoundException();
    }
    if (!claveSetup || !clavesIguales(claveSetup, claveEsperada)) {
      throw new ForbiddenException('Clave de creación de administradores inválida');
    }

    if (!dto?.nombre?.trim() || !dto.apellido?.trim() || !dto.email?.trim() || !dto.password) {
      throw new BadRequestException('Debe ingresar nombre, apellido, email y contraseña');
    }

    exigirPasswordSegura(dto.password);

    // 1. Validar que no exista un usuario con el mismo Email
    const existeUsuario = await this.usuarioRepo.findByEmail(dto.email);
    if (existeUsuario) {
      throw new ConflictException('Ya existe un usuario registrado con ese email');
    }

    // 2. Hashear la contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // 3. Crear el usuario (un admin no está vinculado a un operador)
    const idUsuario = await this.usuarioRepo.create({
      email: dto.email,
      nombre: `${dto.nombre} ${dto.apellido}`,
      rol: 'ADMIN',
      proveedorAuth: 'CREDENCIALES',
      activo: true,
      idOperador: null,
      passwordHash,
    });

    return {
      message: 'Administrador registrado exitosamente',
      idUsuario,
    };
  }
}
