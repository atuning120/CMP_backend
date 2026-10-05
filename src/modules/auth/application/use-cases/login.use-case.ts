import { Injectable, Inject, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { USUARIO_REPOSITORY } from '../../../usuarios/domain/repositories/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { OPERADOR_REPOSITORY } from '../../../operadores/domain/repositories/operador.repository.port';
import type { OperadorRepositoryPort } from '../../../operadores/domain/repositories/operador.repository.port';
import { LoginRequestDto } from '../../interface/http/dtos/login.request.dto';
import { EmisorSesionService, SesionMovilResponse } from '../services/emisor-sesion.service';

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

export type LoginResponse = SesionMovilResponse;

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(OPERADOR_REPOSITORY)
    private readonly operadorRepo: OperadorRepositoryPort,
    private readonly emisorSesion: EmisorSesionService,
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

    // 4. Emitir access + refresh token según el rol (solo operadores y jefes de turno usan este login)
    if (usuario.rol === 'OPERADOR' && usuario.idOperador) {
      return this.emisorSesion.emitir({ idUsuario: usuario.idUsuario, rol: 'OPERADOR', idOperador: usuario.idOperador });
    }

    if (usuario.rol === 'JEFE_TURNO') {
      return this.emisorSesion.emitir({ idUsuario: usuario.idUsuario, rol: 'JEFE_TURNO', idOperador: null });
    }

    throw loginError('SIN_ACCESO_APP');
  }
}
