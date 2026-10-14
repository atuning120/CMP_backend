import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CUENTA_MICROSOFT_REPOSITORY } from '../../../usuarios/domain/repositories/usuario.repository.port';
import type {
  CuentaMicrosoftRepositoryPort,
  UsuarioCuentaMicrosoft,
} from '../../../usuarios/domain/repositories/usuario.repository.port';
import { VERIFICADOR_ENTRA_ID } from '../ports/verificador-entra-id.port';
import type { IdentidadMicrosoft, VerificadorEntraIdPort } from '../ports/verificador-entra-id.port';
import { LoginWebRequestDto } from '../../interface/http/dtos/login-web.request.dto';
import { ROLES_WEB } from './login-web-credenciales.use-case';

// Personal de CMP, de IMOPAC (contratista) y de la UCN (universidad del proyecto: académicos y alumnos).
// Dominios exactos, sin subdominios. Se puede cambiar con WEB_DOMINIOS_PERMITIDOS
const DOMINIOS_POR_DEFECTO = 'cmp.cl,imopac.cl,ucn.cl,alumnos.ucn.cl';
// Tenant de las cuentas personales de Microsoft (outlook.com, hotmail.com): nunca se aceptan
const TENANT_CUENTAS_PERSONALES = '9188040d-6c67-4c5b-b112-36a304b66dad';
const LARGO_MAXIMO_NOMBRE = 100;

export type LoginMicrosoftErrorCode =
  | 'TOKEN_INVALIDO'
  | 'MICROSOFT_NO_CONFIGURADO'
  | 'DOMINIO_NO_PERMITIDO'
  | 'USUARIO_INACTIVO'
  | 'SIN_ACCESO_WEB'
  | 'CUENTA_YA_VINCULADA';

const loginMicrosoftError = (code: LoginMicrosoftErrorCode) => {
  switch (code) {
    case 'TOKEN_INVALIDO':
      return new UnauthorizedException({ statusCode: 401, code, message: 'No se pudo validar la cuenta de Microsoft' });
    case 'MICROSOFT_NO_CONFIGURADO':
      return new ServiceUnavailableException({ statusCode: 503, code, message: 'El inicio de sesión con Microsoft no está configurado' });
    case 'DOMINIO_NO_PERMITIDO':
      return new ForbiddenException({ statusCode: 403, code, message: 'Solo pueden ingresar cuentas institucionales de CMP, IMOPAC o la UCN' });
    case 'USUARIO_INACTIVO':
      return new ForbiddenException({ statusCode: 403, code, message: 'Tu usuario está desactivado' });
    case 'SIN_ACCESO_WEB':
      return new ForbiddenException({ statusCode: 403, code, message: 'El usuario no tiene acceso al panel web' });
    case 'CUENTA_YA_VINCULADA':
      return new ConflictException({ statusCode: 409, code, message: 'Ese correo ya está asociado a otra cuenta de Microsoft' });
  }
};

const lista = (valor: string) =>
  valor
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

export interface SesionWebMicrosoft {
  accessToken: string;
  rol: string;
  email: string;
  nombre: string;
  // true si la cuenta se registró en este login (alta automática como VISOR)
  nuevo: boolean;
}

/**
 * Login del panel web con Microsoft (Entra ID). El Frontend obtiene el ID token con MSAL y lo envía aquí.
 * - Solo cuentas de organizaciones (no personales) con correo de los dominios permitidos
 *   (CMP, IMOPAC y UCN por defecto).
 * - Opcional: AZURE_AD_TENANTS_PERMITIDOS restringe además a esos tenants (ids separados por coma).
 * - La cuenta se reconoce por su oid. Si no existe, se busca por correo: un usuario ya creado
 *   (p. ej. con credenciales) queda vinculado a esa cuenta Microsoft; si tampoco existe, se registra
 *   como VISOR. Los permisos mayores los asigna un administrador.
 */
@Injectable()
export class LoginWebUseCase {
  private readonly logger = new Logger(LoginWebUseCase.name);
  private readonly dominios: string[];
  private readonly tenants: string[];

  constructor(
    @Inject(CUENTA_MICROSOFT_REPOSITORY)
    private readonly cuentaRepo: CuentaMicrosoftRepositoryPort,
    @Inject(VERIFICADOR_ENTRA_ID)
    private readonly verificador: VerificadorEntraIdPort,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.dominios = lista(configService.get<string>('WEB_DOMINIOS_PERMITIDOS', '') || DOMINIOS_POR_DEFECTO);
    this.tenants = lista(configService.get<string>('AZURE_AD_TENANTS_PERMITIDOS', ''));
  }

  async execute(dto: LoginWebRequestDto): Promise<SesionWebMicrosoft> {
    const identidad = await this.verificar(dto?.entraIdToken);
    this.exigirOrganizacionPermitida(identidad);

    const { usuario, nuevo } = await this.buscarOCrear(identidad);
    if (!usuario.activo) throw loginMicrosoftError('USUARIO_INACTIVO');
    if (!ROLES_WEB.includes(usuario.rol)) throw loginMicrosoftError('SIN_ACCESO_WEB');

    const accessToken = this.jwtService.sign({ sub: usuario.idUsuario, rol: usuario.rol });
    return { accessToken, rol: usuario.rol, email: usuario.email, nombre: usuario.nombre, nuevo };
  }

  private async verificar(idToken: unknown): Promise<IdentidadMicrosoft> {
    if (typeof idToken !== 'string' || !idToken) throw loginMicrosoftError('TOKEN_INVALIDO');
    let identidad: IdentidadMicrosoft | null;
    try {
      identidad = await this.verificador.verificar(idToken);
    } catch (error) {
      // Solo el motivo (p. ej. audiencia o emisor esperados), nunca el token
      this.logger.warn(`Token de Microsoft rechazado: ${error instanceof Error ? error.message : String(error)}`);
      throw loginMicrosoftError('TOKEN_INVALIDO');
    }
    if (!identidad) throw loginMicrosoftError('MICROSOFT_NO_CONFIGURADO');
    if (!identidad.oid || !identidad.email) {
      this.logger.warn(`Token de Microsoft sin ${identidad.oid ? 'correo' : 'oid'} (tenant ${identidad.tid})`);
      throw loginMicrosoftError('TOKEN_INVALIDO');
    }
    return identidad;
  }

  private exigirOrganizacionPermitida({ email, tid }: IdentidadMicrosoft) {
    const dominio = email!.split('@').pop()!;
    if (tid === TENANT_CUENTAS_PERSONALES || !this.dominios.includes(dominio)) {
      this.logger.log(`Login con Microsoft rechazado por dominio: @${dominio}`);
      throw loginMicrosoftError('DOMINIO_NO_PERMITIDO');
    }
    if (this.tenants.length > 0 && !this.tenants.includes(tid.toLowerCase())) {
      throw loginMicrosoftError('DOMINIO_NO_PERMITIDO');
    }
  }

  private async buscarOCrear({ oid, email, nombre }: IdentidadMicrosoft): Promise<{ usuario: UsuarioCuentaMicrosoft; nuevo: boolean }> {
    const porOid = await this.cuentaRepo.findByEntraOid(oid);
    if (porOid) return { usuario: porOid, nuevo: false };

    const porEmail = await this.cuentaRepo.findByEmailCualquierEstado(email!);
    if (porEmail) {
      if (porEmail.entraOid && porEmail.entraOid !== oid) throw loginMicrosoftError('CUENTA_YA_VINCULADA');
      // Solo se vincula una cuenta activa: un usuario desactivado sigue sin poder entrar
      if (porEmail.activo) await this.cuentaRepo.vincularEntraOid(porEmail.idUsuario, oid);
      return { usuario: porEmail, nuevo: false };
    }

    const usuario = await this.cuentaRepo.crearDesdeMicrosoft({
      email: email!,
      nombre: (nombre ?? email!.split('@')[0]).slice(0, LARGO_MAXIMO_NOMBRE),
      oid,
    });
    return { usuario, nuevo: true };
  }
}
