import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { USUARIO_REPOSITORY } from '../../domain/repositories/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../domain/repositories/usuario.repository.port';
import { OPERADOR_REPOSITORY } from '../../domain/repositories/operador.repository.port';
import type { OperadorRepositoryPort } from '../../domain/repositories/operador.repository.port';
import { LoginOperadorRequestDto } from '../../interface/http/dtos/login-operador.request.dto';

@Injectable()
export class LoginOperadorUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(OPERADOR_REPOSITORY)
    private readonly operadorRepo: OperadorRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: LoginOperadorRequestDto): Promise<{ accessToken: string }> {
    // 1. Buscar al operador por RUT
    const operador = await this.operadorRepo.findByRut(dto.rut);
    if (!operador) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    
    if (operador.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Operador inactivo');
    }

    // 2. Buscar al usuario asociado a este operador
    const usuario = await this.usuarioRepo.findByIdOperador(operador.idOperador);
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
    const payload = { sub: usuario.idUsuario, rol: usuario.rol, idOperador: operador.idOperador };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }
}
