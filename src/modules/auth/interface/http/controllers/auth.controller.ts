import { Controller, Post, Body, Headers, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { LimiteIntentosGuard } from '../../../infrastructure/limite-intentos';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { LoginRequestDto } from '../dtos/login.request.dto';
import { RegisterOperadorRequestDto } from '../dtos/register-operador.request.dto';
import { LoginWebRequestDto } from '../dtos/login-web.request.dto';
import { LoginWebUseCase } from '../../../application/use-cases/login-web.use-case';
import { RegisterOperadorUseCase } from '../../../application/use-cases/register-operador.use-case';
import { RegisterJefeTurnoUseCase } from '../../../application/use-cases/register-jefe-turno.use-case';
import { RegisterJefeTurnoRequestDto } from '../dtos/register-jefe-turno.request.dto';
import { RegisterAdminUseCase } from '../../../application/use-cases/register-admin.use-case';
import { RegisterAdminRequestDto } from '../dtos/register-admin.request.dto';
import { LoginWebCredencialesUseCase } from '../../../application/use-cases/login-web-credenciales.use-case';
import { LoginWebCredencialesRequestDto } from '../dtos/login-web-credenciales.request.dto';
import { RefreshTokenRequestDto } from '../dtos/refresh-token.request.dto';
import { RefrescarSesionUseCase } from '../../../application/use-cases/refrescar-sesion.use-case';
import { CerrarSesionUseCase } from '../../../application/use-cases/cerrar-sesion.use-case';
import { RefrescarSesionWebUseCase } from '../../../application/use-cases/refrescar-sesion-web.use-case';

// Login y registro llevan límite de intentos (ver limite-intentos.ts); refresh y logout no: el refresh token es
// aleatorio de 48 bytes (no se puede adivinar) y la app los reintenta seguido cuando vuelve la señal
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly loginWebUseCase: LoginWebUseCase,
    private readonly loginWebCredencialesUseCase: LoginWebCredencialesUseCase,
    private readonly registerOperadorUseCase: RegisterOperadorUseCase,
    private readonly registerJefeTurnoUseCase: RegisterJefeTurnoUseCase,
    private readonly registerAdminUseCase: RegisterAdminUseCase,
    private readonly refrescarSesionUseCase: RefrescarSesionUseCase,
    private readonly cerrarSesionUseCase: CerrarSesionUseCase,
    private readonly refrescarSesionWebUseCase: RefrescarSesionWebUseCase,
  ) { }

  @Post('register/operador')
  @UseGuards(LimiteIntentosGuard)
  async registerOperador(@Body() body: RegisterOperadorRequestDto) {
    return this.registerOperadorUseCase.execute(body);
  }

  @Post('register/jefe-turno')
  @UseGuards(LimiteIntentosGuard)
  async registerJefeTurno(@Body() body: RegisterJefeTurnoRequestDto) {
    return this.registerJefeTurnoUseCase.execute(body);
  }

  // Protegido con la clave ADMIN_SETUP_KEY (header x-admin-setup-key)
  @Post('register/admin')
  @UseGuards(LimiteIntentosGuard)
  async registerAdmin(
    @Body() body: RegisterAdminRequestDto,
    @Headers('x-admin-setup-key') claveSetup?: string,
  ) {
    return this.registerAdminUseCase.execute(body, claveSetup);
  }

  @Post('login')
  @UseGuards(LimiteIntentosGuard)
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

  // Renueva la sesión del panel web (misma rotación; acepta los roles con acceso web y no los de la app)
  @Post('refresh/web')
  @HttpCode(HttpStatus.OK)
  async refreshWeb(@Body() body: RefreshTokenRequestDto) {
    return this.refrescarSesionWebUseCase.execute(body?.refreshToken);
  }

  // Revoca el refresh token del dispositivo o del navegador
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: RefreshTokenRequestDto) {
    await this.cerrarSesionUseCase.execute(body?.refreshToken);
  }

  @Post('login/web')
  @UseGuards(LimiteIntentosGuard)
  @HttpCode(HttpStatus.OK)
  async loginWeb(@Body() body: LoginWebRequestDto) {
    return this.loginWebUseCase.execute(body);
  }

  // Login del panel web con email y contraseña; responde { accessToken, refreshToken, refreshTokenExpiraEn, rol }
  @Post('login/web/credenciales')
  @UseGuards(LimiteIntentosGuard)
  @HttpCode(HttpStatus.OK)
  async loginWebCredenciales(@Body() body: LoginWebCredencialesRequestDto) {
    return this.loginWebCredencialesUseCase.execute(body);
  }
}
