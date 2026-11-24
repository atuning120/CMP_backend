import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TurnosModule } from './modules/turnos/turnos.module';
import { AlertasModule } from './modules/alertas/alertas.module';
import { GeocercasModule } from './modules/geocercas/geocercas.module';
import { MaquinasModule } from './modules/maquinas/maquinas.module';
import { EvidenciasModule } from './modules/evidencias/evidencias.module';
import { OperadoresModule } from './modules/operadores/operadores.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AuthModule } from './modules/auth/auth.module';
import { HistorialModule } from './modules/historial/historial.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { AppMovilModule } from './modules/app-movil/app-movil.module';
import { GpsModule } from './modules/gps/gps.module';
import { HealthController } from './health.controller';
import { leerDbPassword } from './shared/infrastructure/config/secretos';
import { leerSslDb } from './shared/infrastructure/config/ssl-db';
import { ValidacionTiposPipe } from './shared/infrastructure/validacion/validacion-tipos.pipe';
import { FiltroExcepciones } from './shared/infrastructure/observabilidad/filtro-excepciones';
import { TrazaRequestInterceptor } from './shared/infrastructure/observabilidad/traza-request.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'cmp_user',
      password: leerDbPassword(process.env.DB_PASSWORD),
      database: process.env.DB_NAME || 'cmp_db',
      ssl: leerSslDb(process.env.DB_SSL, process.env.DB_SSL_CA),
      autoLoadEntities: true,
      synchronize: false, // Las migraciones se encargarán del esquema, no sincronizar automático en dev/prod reales.
    }),
    TurnosModule,
    AlertasModule,
    GeocercasModule,
    MaquinasModule,
    EvidenciasModule,
    OperadoresModule,
    TrackingModule,
    UsuariosModule,
    AuthModule,
    HistorialModule,
    ReportesModule,
    AppMovilModule,
    GpsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Application Insights (init en instrument.ts): excepciones no controladas y la ruta y el usuario de cada request
    { provide: APP_FILTER, useClass: FiltroExcepciones },
    { provide: APP_INTERCEPTOR, useClass: TrazaRequestInterceptor },
    // Como APP_PIPE (y no en main.ts) para que también rija en los tests e2e que levantan AppModule
    { provide: APP_PIPE, useClass: ValidacionTiposPipe },
  ],
})
export class AppModule { }
