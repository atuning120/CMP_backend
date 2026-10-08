import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaquinaController } from './interface/http/controllers/maquina.controller';
import { ModeloMaquinaController } from './interface/http/controllers/modelo-maquina.controller';
import { ListarMaquinasActivasUseCase } from './application/use-cases/listar-maquinas-activas.use-case';
import { ListarFlotaUseCase } from './application/use-cases/listar-flota.use-case';
import { CrearMaquinaUseCase } from './application/use-cases/crear-maquina.use-case';
import { EditarMaquinaUseCase } from './application/use-cases/editar-maquina.use-case';
import { ReemplazarMaquinaUseCase } from './application/use-cases/reemplazar-maquina.use-case';
import { ListarOperadoresAsignablesUseCase } from './application/use-cases/listar-operadores-asignables.use-case';
import { ListarModelosMaquinaUseCase } from './application/use-cases/listar-modelos-maquina.use-case';
import { ListarTiposMaquinaUseCase } from './application/use-cases/listar-tipos-maquina.use-case';
import { ListarMarcasMaquinaUseCase } from './application/use-cases/listar-marcas-maquina.use-case';
import { MaquinaOrmEntity } from './infrastructure/persistence/orm-entities/maquina.orm-entity';
import { ModeloMaquinaOrmEntity } from './infrastructure/persistence/orm-entities/modelo-maquina.orm-entity';
import { MaquinaPostgresqlRepository } from './infrastructure/persistence/repositories/maquina.postgresql-repository';
import { ModeloMaquinaPostgresqlRepository } from './infrastructure/persistence/repositories/modelo-maquina.postgresql-repository';
import { MAQUINA_REPOSITORY } from './domain/repositories/maquina.repository.port';
import { MODELO_MAQUINA_REPOSITORY } from './domain/repositories/modelo-maquina.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([MaquinaOrmEntity, ModeloMaquinaOrmEntity])],
  controllers: [MaquinaController, ModeloMaquinaController],
  providers: [
    {
      provide: MAQUINA_REPOSITORY,
      useClass: MaquinaPostgresqlRepository,
    },
    {
      provide: MODELO_MAQUINA_REPOSITORY,
      useClass: ModeloMaquinaPostgresqlRepository,
    },
    ListarMaquinasActivasUseCase,
    ListarFlotaUseCase,
    CrearMaquinaUseCase,
    EditarMaquinaUseCase,
    ListarOperadoresAsignablesUseCase,
    ReemplazarMaquinaUseCase,
    ListarModelosMaquinaUseCase,
    ListarTiposMaquinaUseCase,
    ListarMarcasMaquinaUseCase,
  ],
  exports: [MAQUINA_REPOSITORY],
})
export class MaquinasModule {}
