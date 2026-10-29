import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LimiteIntentosGuard } from '../../../infrastructure/limite-intentos';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { LoginRequestDto } from '../dtos/login.request.dto';
import { LoginWebRequestDto } from '../dtos/login-web.request.dto';
import { LoginWebUseCase } from '../../../application/use-cases/login-web.use-case';
import { RegisterAdminUseCase } from '../../../application/use-cases/register-admin.use-case';
import { RegisterAdminRequestDto } from '../dtos/register-admin.request.dto';
import { LoginWebCredencialesUseCase } from '../../../application/use-cases/login-web-credenciales.use-case';
import { LoginWebCredencialesRequestDto } from '../dtos/login-web-credenciales.request.dto';
import { RefreshTokenRequestDto } from '../dtos/refresh-token.request.dto';
import { RefrescarSesionUseCase } from '../../../application/use-cases/refrescar-sesion.use-case';
import { CerrarSesionUseCase } from '../../../application/use-cases/cerrar-sesion.use-case';
import { RefrescarSesionWebUseCase } from '../../../application/use-cases/refrescar-sesion-web.use-case';
import { borrarCookieSesion, leerCookieSesion, responderSesionWeb, usaCookie } from '../sesion-web.cookie';

// Login y registro llevan límite de intentos (ver limite-intentos.ts); refresh y logout no: el refresh token es
// aleatorio de 48 bytes (no se puede adivinar) y la app los reintenta seguido cuando vuelve la señal
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly loginWebUseCase: LoginWebUseCase,
    private readonly loginWebCredencialesUseCase: LoginWebCredencialesUseCase,
    private readonly registerAdminUseCase: RegisterAdminUseCase,
    private readonly refrescarSesionUseCase: RefrescarSesionUseCase,
    private readonly cerrarSesionUseCase: CerrarSesionUseCase,
    private readonly refrescarSesionWebUseCase: RefrescarSesionWebUseCase,
  ) { }

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

  // Renueva la sesión del panel web (misma rotación; acepta los roles con acceso web y no los de la app).
  // Con X-Sesion-Web el token sale de la cookie; el del cuerpo queda para las sesiones guardadas antes de la cookie
  @Post('refresh/web')
  @HttpCode(HttpStatus.OK)
  async refreshWeb(@Body() body: RefreshTokenRequestDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = usaCookie(req) ? (leerCookieSesion(req) ?? body?.refreshToken) : body?.refreshToken;
    return responderSesionWeb(req, res, await this.refrescarSesionWebUseCase.execute(refreshToken));
  }

  // Revoca el refresh token del dispositivo (cuerpo) o del navegador (cookie, que además se borra)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: RefreshTokenRequestDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!usaCookie(req)) return this.cerrarSesionUseCase.execute(body?.refreshToken);
    await this.cerrarSesionUseCase.execute(leerCookieSesion(req) ?? body?.refreshToken);
    borrarCookieSesion(req, res);
  }

  @Post('login/web')
  @UseGuards(LimiteIntentosGuard)
  @HttpCode(HttpStatus.OK)
  async loginWeb(@Body() body: LoginWebRequestDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return responderSesionWeb(req, res, await this.loginWebUseCase.execute(body));
  }

  // Login del panel web con email y contraseña; responde { accessToken, refreshTokenExpiraEn, rol } (+ refreshToken sin cookie)
  @Post('login/web/credenciales')
  @UseGuards(LimiteIntentosGuard)
  @HttpCode(HttpStatus.OK)
  async loginWebCredenciales(
    @Body() body: LoginWebCredencialesRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return responderSesionWeb(req, res, await this.loginWebCredencialesUseCase.execute(body));
  }
}
