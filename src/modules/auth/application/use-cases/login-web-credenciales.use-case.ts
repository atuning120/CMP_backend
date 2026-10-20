import { BadRequestException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { passwordCorrecta } from '../password-segura';
import { USUARIO_REPOSITORY } from '../../../usuarios/domain/repositories/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { LoginWebCredencialesRequestDto } from '../../interface/http/dtos/login-web-credenciales.request.dto';
import { EmisorSesionService, SesionWebResponse } from '../services/emisor-sesion.service';

// Roles que pueden usar el panel web; los operadores solo usan la app móvil
export const ROLES_WEB = ['ADMIN', 'JEFE_TURNO', 'VISOR'];

export type LoginWebErrorCode = 'DATOS_INCOMPLETOS' | 'CREDENCIALES_INVALIDAS' | 'SIN_ACCESO_WEB';

// Mismo formato que los errores del login móvil: código estable + mensaje genérico
const loginWebError = (code: LoginWebErrorCode) => {
  switch (code) {
    case 'DATOS_INCOMPLETOS':
      return new BadRequestException({ statusCode: 400, code, message: 'Debe ingresar email y contraseña' });
    case 'CREDENCIALES_INVALIDAS':
      return new UnauthorizedException({ statusCode: 401, code, message: 'Credenciales inválidas' });
    case 'SIN_ACCESO_WEB':
      return new ForbiddenException({ statusCode: 403, code, message: 'El usuario no tiene acceso al panel web' });
  }
};

/**
 * Login del panel web con email y contraseña (alternativa al login con Entra ID).
 * Devuelve el rol para que el Frontend decida qué vistas mostrar; los permisos reales
 * los sigue validando cada endpoint con el JWT.
 */
@Injectable()
export class LoginWebCredencialesUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepositoryPort,
    private readonly emisorSesion: EmisorSesionService,
  ) {}

  async execute(dto: LoginWebCredencialesRequestDto): Promise<SesionWebResponse> {
    if (!dto?.email?.trim() || !dto.password) {
      throw loginWebError('DATOS_INCOMPLETOS');
    }

    // findByEmail solo devuelve usuarios activos
    const usuario = await this.usuarioRepo.findByEmail(dto.email.trim());
    // Se compara aunque la cuenta no exista, para que el tiempo de respuesta no lo revele
    if (!(await passwordCorrecta(dto.password, usuario?.passwordHash)) || !usuario) {
      throw loginWebError('CREDENCIALES_INVALIDAS');
    }

    // El rol solo se informa a quien ya demostró conocer la contraseña
    if (!ROLES_WEB.includes(usuario.rol)) {
      throw loginWebError('SIN_ACCESO_WEB');
    }

    return this.emisorSesion.emitirWeb(usuario);
  }
}
