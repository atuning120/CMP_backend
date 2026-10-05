import { Injectable, Inject, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { USUARIO_REPOSITORY } from '../../../usuarios/domain/repositories/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { OPERADOR_REPOSITORY } from '../../../operadores/domain/repositories/operador.repository.port';
import type { OperadorRepositoryPort } from '../../../operadores/domain/repositories/operador.repository.port';
import { LoginRequestDto } from '../../interface/http/dtos/login.request.dto';

// Errores del login: cada tipo tiene un código estable y un mensaje genérico para el cliente.
// Usuario inexistente, contraseña incorrecta y usuario sin contraseña comparten el mismo error
// para no revelar qué cuentas existen.
export type LoginErrorCode = 'DATOS_INCOMPLETOS' | 'CREDENCIALES_INVALIDAS' | 'OPERADOR_INACTIVO' | 'SIN_ACCESO_APP';

const loginError = (code: LoginErrorCode) => {
  switch (code) {
    case 'DATOS_INCOMPLETOS':
      return new BadRequestException({ statusCode: 400, code, message: 'Debe ingresar email o RUT y contraseña' });
    case 'CREDENCIALES_INVALIDAS':
      return new UnauthorizedException({ statusCode: 401, code, message: 'Credenciales inválidas' });
    case 'OPERADOR_INACTIVO':
      return new ForbiddenException({ statusCode: 403, code, message: 'El operador se encuentra inactivo' });
    case 'SIN_ACCESO_APP':
      return new ForbiddenException({ statusCode: 403, code, message: 'El usuario no tiene acceso a la aplicación móvil' });
  }
};

export type LoginResponse =
  | { accessToken: string; rol: 'OPERADOR'; idOperador: number }
  | { accessToken: string; rol: 'JEFE_TURNO' };

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(OPERADOR_REPOSITORY)
    private readonly operadorRepo: OperadorRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: LoginRequestDto): Promise<LoginResponse> {
    if ((!dto.rut && !dto.email) || !dto.password) {
      throw loginError('DATOS_INCOMPLETOS');
    }

    let usuario;
    let operadorActivo = true;

    // 1. Buscar por RUT (solo operadores) o Email
    if (dto.rut) {
      const operador = await this.operadorRepo.findByRut(dto.rut);
      if (!operador) {
        throw loginError('CREDENCIALES_INVALIDAS');
      }
      operadorActivo = operador.estado === 'ACTIVO';
      usuario = await this.usuarioRepo.findByIdOperador(operador.idOperador);
      if (usuario) {
        usuario = { ...usuario, idOperador: operador.idOperador };
      }
    } else if (dto.email) {
      usuario = await this.usuarioRepo.findByEmail(dto.email);
    }

    // 2. Verificar usuario y contraseña
    if (!usuario || !usuario.passwordHash) {
      throw loginError('CREDENCIALES_INVALIDAS');
    }

    const isValid = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!isValid) {
      throw loginError('CREDENCIALES_INVALIDAS');
    }

    // 3. El estado del operador solo se informa a quien ya demostró conocer la contraseña
    if (!operadorActivo) {
      throw loginError('OPERADOR_INACTIVO');
    }

    // 4. Generar JWT y responder según el rol (solo operadores y jefes de turno usan este login)
    if (usuario.rol === 'OPERADOR' && usuario.idOperador) {
      const payload = { sub: usuario.idUsuario, rol: usuario.rol, idOperador: usuario.idOperador };
      return { accessToken: this.jwtService.sign(payload), rol: 'OPERADOR', idOperador: usuario.idOperador };
    }

    if (usuario.rol === 'JEFE_TURNO') {
      const payload = { sub: usuario.idUsuario, rol: usuario.rol };
      return { accessToken: this.jwtService.sign(payload), rol: 'JEFE_TURNO' };
    }

    throw loginError('SIN_ACCESO_APP');
  }
}
