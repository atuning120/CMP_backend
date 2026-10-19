import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { leerJwtSecret } from '../../shared/infrastructure/config/secretos';
import { LIMITE_INTENTOS } from './infrastructure/limite-intentos';
import { AuthController } from './interface/http/controllers/auth.controller';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LoginWebUseCase } from './application/use-cases/login-web.use-case';
import { LoginWebCredencialesUseCase } from './application/use-cases/login-web-credenciales.use-case';
import { RegisterOperadorUseCase } from './application/use-cases/register-operador.use-case';
import { RegisterJefeTurnoUseCase } from './application/use-cases/register-jefe-turno.use-case';
import { RegisterAdminUseCase } from './application/use-cases/register-admin.use-case';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { OperadoresModule } from '../operadores/operadores.module';
import { RefrescarSesionUseCase } from './application/use-cases/refrescar-sesion.use-case';
import { CerrarSesionUseCase } from './application/use-cases/cerrar-sesion.use-case';
import { EmisorSesionService } from './application/services/emisor-sesion.service';
import { VERIFICADOR_ENTRA_ID } from './application/ports/verificador-entra-id.port';
import { VerificadorEntraIdAdapter } from './infrastructure/adapters/verificador-entra-id.adapter';
import { RefreshTokenOrmEntity } from './infrastructure/persistence/orm-entities/refresh-token.orm-entity';
import { RefreshTokenPostgresqlRepository } from './infrastructure/persistence/repositories/refresh-token.postgresql-repository';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository.port';

@Module({
  imports: [
    UsuariosModule,
    OperadoresModule,
    TypeOrmModule.forFeature([RefreshTokenOrmEntity]),
    ThrottlerModule.forRoot(LIMITE_INTENTOS),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: leerJwtSecret(config.get<string>('JWT_SECRET')),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    LoginWebUseCase,
    LoginWebCredencialesUseCase,
    RegisterOperadorUseCase,
    RegisterJefeTurnoUseCase,
    RegisterAdminUseCase,
    RefrescarSesionUseCase,
    CerrarSesionUseCase,
    EmisorSesionService,
    JwtStrategy,
    { provide: VERIFICADOR_ENTRA_ID, useClass: VerificadorEntraIdAdapter },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: RefreshTokenPostgresqlRepository,
    },
  ],
  exports: [JwtModule],
})
export class AuthModule { }
