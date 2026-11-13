import { Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../../auth/interface/http/decorators/roles.decorator';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import {
  MarcarRecorridoVistoUseCase,
  ObtenerRecorridosUseCase,
} from '../../../application/use-cases/recorridos-guiados.use-case';

// Datos propios del usuario de la sesión en el panel web (cualquier rol con acceso web)
@Controller('perfil')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'JEFE_TURNO', 'VISOR')
export class PerfilController {
  constructor(
    private readonly obtenerRecorridosUseCase: ObtenerRecorridosUseCase,
    private readonly marcarRecorridoVistoUseCase: MarcarRecorridoVistoUseCase,
  ) {}

  // Recorridos guiados ya hechos u omitidos: { vistos: string[] } (vacío = primer ingreso)
  @Get('recorridos')
  async recorridos(@CurrentUser() user: { idUsuario: number; rol: string }) {
    return this.obtenerRecorridosUseCase.execute(user);
  }

  // Terminó u omitió el recorrido: no se le vuelve a ofrecer solo. Idempotente; responde { vistos }
  @Put('recorridos/:recorrido')
  async marcarRecorrido(@Param('recorrido') recorrido: string, @CurrentUser() user: { idUsuario: number; rol: string }) {
    return this.marcarRecorridoVistoUseCase.execute({ recorrido, autor: user });
  }
}
