import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'cmp_user',
      password: process.env.DB_PASSWORD || 'cmp_pass',
      database: process.env.DB_NAME || 'cmp_db',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
