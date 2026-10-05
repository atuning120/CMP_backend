import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './interface/http/controllers/auth.controller';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LoginWebUseCase } from './application/use-cases/login-web.use-case';
import { RegisterOperadorUseCase } from './application/use-cases/register-operador.use-case';
import { RegisterJefeTurnoUseCase } from './application/use-cases/register-jefe-turno.use-case';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { OperadoresModule } from '../operadores/operadores.module';
import { RefrescarSesionUseCase } from './application/use-cases/refrescar-sesion.use-case';
import { CerrarSesionUseCase } from './application/use-cases/cerrar-sesion.use-case';
import { EmisorSesionService } from './application/services/emisor-sesion.service';
import { RefreshTokenOrmEntity } from './infrastructure/persistence/orm-entities/refresh-token.orm-entity';
import { RefreshTokenPostgresqlRepository } from './infrastructure/persistence/repositories/refresh-token.postgresql-repository';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository.port';

@Module({
  imports: [
    UsuariosModule,
    OperadoresModule,
    TypeOrmModule.forFeature([RefreshTokenOrmEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'super_secret_dev_key'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    LoginWebUseCase,
    RegisterOperadorUseCase,
    RegisterJefeTurnoUseCase,
    RefrescarSesionUseCase,
    CerrarSesionUseCase,
    EmisorSesionService,
    JwtStrategy,
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: RefreshTokenPostgresqlRepository,
    },
  ],
  exports: [JwtModule],
})
export class AuthModule { }
