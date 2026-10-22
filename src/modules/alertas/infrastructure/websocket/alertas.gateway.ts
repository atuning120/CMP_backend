import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { OnGatewayInit } from '@nestjs/websockets';
import type { Namespace } from 'socket.io';
import { autenticarSocket } from '../../../../shared/infrastructure/websocket/autenticar-socket';
import { ROLES_ALERTAS } from '../../application/use-cases/listar-alertas.use-case';
import type { NovedadAlertas, PublicadorAlertasPort } from '../../application/ports/publicador-alertas.port';

/**
 * Alertas de turno en tiempo real para el panel web (Socket.IO, namespace /alertas), solo jefes de turno y
 * administradores (los mismos de GET /alertas). JWT en `auth.token`. Evento: `alertas` con NovedadAlertas.
 */
@WebSocketGateway({ namespace: '/alertas', cors: { origin: true } })
export class AlertasGateway implements OnGatewayInit, PublicadorAlertasPort {
  private readonly logger = new Logger(AlertasGateway.name);

  @WebSocketServer()
  private readonly servidor: Namespace;

  constructor(private readonly jwtService: JwtService) {}

  afterInit(servidor: Namespace) {
    servidor.use(autenticarSocket(this.jwtService, ROLES_ALERTAS));
  }

  publicar(novedad: NovedadAlertas) {
    this.servidor.emit('alertas', novedad);
    this.logger.debug(`Publicadas ${novedad.nuevas.length} alertas nuevas (${novedad.activas} activas)`);
  }
}
