import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { OnGatewayInit } from '@nestjs/websockets';
import type { Namespace } from 'socket.io';
import { autenticarSocket } from '../../../../shared/infrastructure/websocket/autenticar-socket';
import type { CambioEstadoMaquina, PublicadorEstadosPort } from '../../application/ports/publicador-estados.port';

/**
 * Cambios de estado operacional en tiempo real para el mapa del panel web (Socket.IO, namespace /estados). JWT en
 * `auth.token`, cualquier rol (el mapa lo ve también un VISOR). Evento: `estados` con CambioEstadoMaquina.
 */
@WebSocketGateway({ namespace: '/estados', cors: { origin: true } })
export class EstadosGateway implements OnGatewayInit, PublicadorEstadosPort {
  private readonly logger = new Logger(EstadosGateway.name);

  @WebSocketServer()
  private readonly servidor: Namespace;

  constructor(private readonly jwtService: JwtService) {}

  afterInit(servidor: Namespace) {
    servidor.use(autenticarSocket(this.jwtService));
  }

  publicar(cambio: CambioEstadoMaquina) {
    this.servidor.emit('estados', cambio);
    this.logger.debug(`Máquina ${cambio.idMaquina}: estado ${cambio.estadoOperacional.nombre}`);
  }
}
