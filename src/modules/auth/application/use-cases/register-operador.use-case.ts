import { Injectable, Inject, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { USUARIO_REPOSITORY } from '../../../usuarios/domain/repositories/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { OPERADOR_REPOSITORY } from '../../../operadores/domain/repositories/operador.repository.port';
import type { OperadorRepositoryPort } from '../../../operadores/domain/repositories/operador.repository.port';
import { RegisterOperadorRequestDto } from '../../interface/http/dtos/register-operador.request.dto';

@Injectable()
export class RegisterOperadorUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(OPERADOR_REPOSITORY)
    private readonly operadorRepo: OperadorRepositoryPort,
  ) {}

  async execute(dto: RegisterOperadorRequestDto): Promise<{ message: string; idOperador: number; idUsuario: number }> {
    // 1. Validar que no exista un operador con el mismo RUT
    const existeOperador = await this.operadorRepo.findByRut(dto.rut);
    if (existeOperador) {
      throw new ConflictException('Ya existe un operador registrado con ese RUT');
    }

    // 2. Validar que no exista un usuario con el mismo Email
    const existeUsuario = await this.usuarioRepo.findByEmail(dto.email);
    if (existeUsuario) {
      throw new ConflictException('Ya existe un usuario registrado con ese email');
    }

    // 3. Crear el operador
    const idOperador = await this.operadorRepo.create({
      nombre: dto.nombre,
      apellido: dto.apellido,
      rut: dto.rut,
      telefono: dto.telefono,
      estado: 'ACTIVO',
    });

    // 4. Hashear la contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // 5. Crear el usuario vinculado al operador
    const idUsuario = await this.usuarioRepo.create({
      email: dto.email,
      nombre: `${dto.nombre} ${dto.apellido}`,
      rol: 'OPERADOR',
      proveedorAuth: 'CREDENCIALES',
      activo: true,
      idOperador: idOperador,
      passwordHash: passwordHash,
    });

    return {
      message: 'Operador registrado exitosamente',
      idOperador,
      idUsuario,
    };
  }
}
