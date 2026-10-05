import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { LoginRequestDto } from '../dtos/login.request.dto';
import { RegisterOperadorRequestDto } from '../dtos/register-operador.request.dto';
import { LoginWebRequestDto } from '../dtos/login-web.request.dto';
import { LoginWebUseCase } from '../../../application/use-cases/login-web.use-case';
import { RegisterOperadorUseCase } from '../../../application/use-cases/register-operador.use-case';
import { RegisterJefeTurnoUseCase } from '../../../application/use-cases/register-jefe-turno.use-case';
import { RegisterJefeTurnoRequestDto } from '../dtos/register-jefe-turno.request.dto';
import { RefreshTokenRequestDto } from '../dtos/refresh-token.request.dto';
import { RefrescarSesionUseCase } from '../../../application/use-cases/refrescar-sesion.use-case';
import { CerrarSesionUseCase } from '../../../application/use-cases/cerrar-sesion.use-case';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly loginWebUseCase: LoginWebUseCase,
    private readonly registerOperadorUseCase: RegisterOperadorUseCase,
    private readonly registerJefeTurnoUseCase: RegisterJefeTurnoUseCase,
    private readonly refrescarSesionUseCase: RefrescarSesionUseCase,
    private readonly cerrarSesionUseCase: CerrarSesionUseCase,
  ) { }

  @Post('register/operador')
  async registerOperador(@Body() body: RegisterOperadorRequestDto) {
    return this.registerOperadorUseCase.execute(body);
  }

  @Post('register/jefe-turno')
  async registerJefeTurno(@Body() body: RegisterJefeTurnoRequestDto) {
    return this.registerJefeTurnoUseCase.execute(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginRequestDto) {
    return this.loginUseCase.execute(body);
  }

  // Renueva la sesión móvil con el refresh token (rotación: el token usado deja de ser válido)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshTokenRequestDto) {
    return this.refrescarSesionUseCase.execute(body?.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: RefreshTokenRequestDto) {
    await this.cerrarSesionUseCase.execute(body?.refreshToken);
  }

  @Post('login/web')
  @HttpCode(HttpStatus.OK)
  async loginWeb(@Body() body: LoginWebRequestDto) {
    return this.loginWebUseCase.execute(body);
  }
}
