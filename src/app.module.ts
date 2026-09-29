import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TurnosModule } from './modules/turnos/turnos.module';

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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
