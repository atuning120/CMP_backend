import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { USUARIO_REPOSITORY } from '../../../usuarios/domain/repositories/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { OPERADOR_REPOSITORY } from '../../../operadores/domain/repositories/operador.repository.port';
import type { OperadorRepositoryPort } from '../../../operadores/domain/repositories/operador.repository.port';
import { LoginRequestDto } from '../../interface/http/dtos/login-operador.request.dto';

@Injectable()
export class LoginOperadorUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(OPERADOR_REPOSITORY)
    private readonly operadorRepo: OperadorRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: LoginRequestDto): Promise<{ accessToken: string; rol: string }> {
    if (!dto.rut && !dto.email) {
      throw new UnauthorizedException('Debe proporcionar RUT o Email para iniciar sesión');
    }

    let usuario;
    let idOperador: number | null = null;

    // 1. Buscar por RUT o Email
    if (dto.rut) {
      const operador = await this.operadorRepo.findByRut(dto.rut);
      if (!operador || operador.estado !== 'ACTIVO') {
        throw new UnauthorizedException('Credenciales inválidas o operador inactivo');
      }
      idOperador = operador.idOperador;
      usuario = await this.usuarioRepo.findByIdOperador(operador.idOperador);
    } else if (dto.email) {
      usuario = await this.usuarioRepo.findByEmail(dto.email);
      if (usuario) {
        idOperador = usuario.idOperador;
      }
    }

    // 2. Verificar usuario
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Verificar contraseña
    if (!usuario.passwordHash) {
      throw new UnauthorizedException('Usuario sin contraseña configurada');
    }

    const isValid = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 4. Generar JWT
    const payload = { sub: usuario.idUsuario, rol: usuario.rol, idOperador: idOperador };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken, rol: usuario.rol };
  }
}
