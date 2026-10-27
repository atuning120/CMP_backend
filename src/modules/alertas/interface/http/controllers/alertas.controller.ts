import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { ListarAlertasUseCase } from '../../../application/use-cases/listar-alertas.use-case';
import { AtenderAlertaUseCase } from '../../../application/use-cases/atender-alerta.use-case';

// Pestaña Alertas del jefe de turno: turnos de más de 10 h y cierres automáticos, del más reciente al más antiguo
@Controller('alertas')
@UseGuards(JwtAuthGuard)
export class AlertasController {
  constructor(
    private readonly listarAlertasUseCase: ListarAlertasUseCase,
    private readonly atenderAlertaUseCase: AtenderAlertaUseCase,
  ) {}

  // ?tipo=TODO|EXTENDIDOS|CIERRES_AUTOMATICOS&estado=TODAS|PENDIENTES|ATENDIDAS&desde=<ISO>&hasta=<ISO>
  // &antes=<fecha ISO de la última>&antesId=<su id>&limite=30. Cada alerta trae sus atenciones (vacío = pendiente)
  @Get()
  async listar(
    @CurrentUser() user: { rol: string },
    @Query('tipo') tipo?: string,
    @Query('estado') estado?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('antes') antes?: string,
    @Query('antesId') antesId?: string,
    @Query('limite') limite?: string,
  ) {
    return this.listarAlertasUseCase.execute({ rol: user?.rol, tipo, estado, desde, hasta, antes, antesId, limite });
  }

  // Atiende la alerta (la primera vez; comentario opcional) o le agrega una nota (comentario obligatorio).
  // Responde { idAlerta, atenciones } con todas sus atenciones. idCliente (UUID) hace idempotente el reintento;
  // atencionesVistas: cuántas tenía al atenderla (si otro la atendió entremedio, se acepta sin comentario);
  // fechaAccion: cuándo la atendió, si se hizo sin señal y se envía después
  @Post(':idAlerta/atenciones')
  @HttpCode(HttpStatus.CREATED)
  async atender(
    @Param('idAlerta') idAlerta: string,
    @Body() body: { comentario?: string; idCliente?: string; atencionesVistas?: number; fechaAccion?: string },
    @CurrentUser() user: { idUsuario: number; rol: string },
  ) {
    return this.atenderAlertaUseCase.execute({
      idAlerta,
      comentario: body?.comentario,
      autor: user,
      idCliente: body?.idCliente,
      atencionesVistas: body?.atencionesVistas,
      fechaAccion: body?.fechaAccion,
    });
  }
}
