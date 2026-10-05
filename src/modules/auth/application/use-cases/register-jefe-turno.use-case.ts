import { Injectable, Inject, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { USUARIO_REPOSITORY } from '../../../usuarios/domain/repositories/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { RegisterJefeTurnoRequestDto } from '../../interface/http/dtos/register-jefe-turno.request.dto';

@Injectable()
export class RegisterJefeTurnoUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepositoryPort,
  ) {}

  async execute(dto: RegisterJefeTurnoRequestDto): Promise<{ message: string; idUsuario: number }> {
    // 1. Validar que no exista un usuario con el mismo Email
    const existeUsuario = await this.usuarioRepo.findByEmail(dto.email);
    if (existeUsuario) {
      throw new ConflictException('Ya existe un usuario registrado con ese email');
    }

    // 2. Hashear la contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // 3. Crear el usuario (un jefe de turno no está vinculado a un operador)
    const idUsuario = await this.usuarioRepo.create({
      email: dto.email,
      nombre: `${dto.nombre} ${dto.apellido}`,
      rol: 'JEFE_TURNO',
      proveedorAuth: 'CREDENCIALES',
      activo: true,
      idOperador: null,
      passwordHash: passwordHash,
    });

    return {
      message: 'Jefe de turno registrado exitosamente',
      idUsuario,
    };
  }
}
