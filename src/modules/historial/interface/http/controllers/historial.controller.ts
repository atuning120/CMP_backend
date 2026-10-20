import { Controller, Get, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { ListarHistorialUseCase } from '../../../application/use-cases/listar-historial.use-case';
import { ExportarHistorialUseCase } from '../../../application/use-cases/exportar-historial.use-case';

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Pestaña Historial del jefe de turno: acciones sobre la flota e inicios de turno, del más reciente al más antiguo
@Controller('historial')
@UseGuards(JwtAuthGuard)
export class HistorialController {
  constructor(
    private readonly listarHistorialUseCase: ListarHistorialUseCase,
    private readonly exportarHistorialUseCase: ExportarHistorialUseCase,
  ) {}

  // ?tipo=TODO|TURNOS|FLOTA&desde=<ISO>&hasta=<ISO>&antes=<fecha ISO del último evento>&antesId=<su id>&limite=30
  @Get()
  async listar(
    @CurrentUser() user: { rol: string },
    @Query('tipo') tipo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('antes') antes?: string,
    @Query('antesId') antesId?: string,
    @Query('limite') limite?: string,
  ) {
    return this.listarHistorialUseCase.execute({ rol: user?.rol, tipo, desde, hasta, antes, antesId, limite });
  }

  // Todo el rango en un .xlsx (sin paginar): ?tipo&desde&hasta como el listado y zonaHoraria=<IANA> para las fechas del archivo
  @Get('excel')
  async exportar(
    @CurrentUser() user: { rol: string },
    @Query('tipo') tipo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('zonaHoraria') zonaHoraria?: string,
  ) {
    const { contenido, nombre } = await this.exportarHistorialUseCase.execute({ rol: user?.rol, tipo, desde, hasta, zonaHoraria });
    return new StreamableFile(contenido, { type: TIPO_XLSX, disposition: `attachment; filename="${nombre}"`, length: contenido.length });
  }
}
