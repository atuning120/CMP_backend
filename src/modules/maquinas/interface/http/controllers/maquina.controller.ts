import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { ListarMaquinasActivasUseCase } from '../../../application/use-cases/listar-maquinas-activas.use-case';
import { ListarFlotaUseCase } from '../../../application/use-cases/listar-flota.use-case';
import { CrearMaquinaUseCase } from '../../../application/use-cases/crear-maquina.use-case';
import { ListarTiposMaquinaUseCase } from '../../../application/use-cases/listar-tipos-maquina.use-case';
import { ListarMarcasMaquinaUseCase } from '../../../application/use-cases/listar-marcas-maquina.use-case';
import { CrearMaquinaRequestDto } from '../dtos/crear-maquina.request.dto';
import { EditarMaquinaUseCase } from '../../../application/use-cases/editar-maquina.use-case';
import { ReemplazarMaquinaUseCase } from '../../../application/use-cases/reemplazar-maquina.use-case';
import { ReemplazarMaquinaRequestDto } from '../dtos/reemplazar-maquina.request.dto';
import { ListarOperadoresAsignablesUseCase } from '../../../application/use-cases/listar-operadores-asignables.use-case';
import { EditarMaquinaRequestDto } from '../dtos/editar-maquina.request.dto';

@Controller('maquinas')
@UseGuards(JwtAuthGuard)
export class MaquinaController {
  constructor(
    private readonly listarMaquinasActivasUseCase: ListarMaquinasActivasUseCase,
    private readonly listarFlotaUseCase: ListarFlotaUseCase,
    private readonly crearMaquinaUseCase: CrearMaquinaUseCase,
    private readonly listarTiposMaquinaUseCase: ListarTiposMaquinaUseCase,
    private readonly listarMarcasMaquinaUseCase: ListarMarcasMaquinaUseCase,
    private readonly editarMaquinaUseCase: EditarMaquinaUseCase,
    private readonly listarOperadoresAsignablesUseCase: ListarOperadoresAsignablesUseCase,
    private readonly reemplazarMaquinaUseCase: ReemplazarMaquinaUseCase,
  ) {}

  @Get()
  async listarActivas() {
    return this.listarMaquinasActivasUseCase.execute();
  }

  // Vista del jefe de turno: todas las máquinas (también BAJA), filtradas por ?busqueda=
  @Get('flota')
  async listarFlota(@Query('busqueda') busqueda?: string) {
    return this.listarFlotaUseCase.execute(typeof busqueda === 'string' ? busqueda : undefined);
  }

  // Opciones del selector "Tipo de máquina" al incorporar una máquina
  @Get('tipos')
  async listarTipos() {
    return this.listarTiposMaquinaUseCase.execute();
  }

  // Opciones del selector "Marca" al incorporar una máquina
  @Get('marcas')
  async listarMarcas() {
    return this.listarMarcasMaquinaUseCase.execute();
  }

  // Opciones del selector "Operador asignado" (jefe de turno), con la máquina que cada uno tiene hoy
  @Get('operadores')
  async listarOperadores(@CurrentUser() user: { rol: string }) {
    return this.listarOperadoresAsignablesUseCase.execute(user?.rol);
  }

  // Incorporación de una máquina nueva a planta (jefe de turno)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() body: CrearMaquinaRequestDto, @CurrentUser() user: { rol: string; idUsuario: number }) {
    return this.crearMaquinaUseCase.execute({
      rol: user?.rol,
      idUsuario: user?.idUsuario,
      nombre: body?.nombre,
      marca: body?.marca,
      modelo: body?.modelo,
      anio: body?.anio,
      tipoMaquina: body?.tipoMaquina,
      patente: body?.patente,
      numeroChasis: body?.numeroChasis,
      horometroInicial: body?.horometroInicial,
      esContratista: body?.esContratista,
      idOperador: body?.idOperador,
      motivo: body?.motivo,
      observacion: body?.observacion,
    });
  }

  // Reemplazo (jefe de turno): la máquina :id sale de servicio y otra de la flota o una nueva toma su lugar
  @Post(':id/reemplazo')
  async reemplazar(
    @Param('id') id: string,
    @Body() body: ReemplazarMaquinaRequestDto,
    @CurrentUser() user: { rol: string; idUsuario: number },
  ) {
    return this.reemplazarMaquinaUseCase.execute({
      rol: user?.rol,
      idUsuario: user?.idUsuario,
      idMaquina: id,
      idMaquinaEntrante: body?.idMaquinaEntrante,
      maquinaNueva: body?.maquinaNueva,
      idOperador: body?.idOperador,
      motivo: body?.motivo,
      observacion: body?.observacion,
    });
  }

  // Edición de la ficha de una máquina (jefe de turno); el cambio de estado también pasa por aquí
  @Patch(':id')
  async editar(
    @Param('id') id: string,
    @Body() body: EditarMaquinaRequestDto,
    @CurrentUser() user: { rol: string; idUsuario: number },
  ) {
    return this.editarMaquinaUseCase.execute({
      rol: user?.rol,
      idUsuario: user?.idUsuario,
      idMaquina: id,
      nombre: body?.nombre,
      marca: body?.marca,
      modelo: body?.modelo,
      anio: body?.anio,
      tipoMaquina: body?.tipoMaquina,
      patente: body?.patente,
      numeroChasis: body?.numeroChasis,
      esContratista: body?.esContratista,
      idOperador: body?.idOperador,
      estado: body?.estado,
      motivo: body?.motivo,
      observacion: body?.observacion,
    });
  }
}
