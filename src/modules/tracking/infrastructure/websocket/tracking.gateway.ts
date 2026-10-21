import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { OnGatewayInit } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { PosicionMaquina } from '../../domain/entities/posicion-gps';
import type { PublicadorPosicionesPort } from '../../application/ports/publicador-posiciones.port';

/**
 * Posiciones en tiempo real para el panel web (Socket.IO, namespace /tracking). El cliente se conecta con su JWT
 * en `auth.token`; sin token válido la conexión se rechaza. Cuando el JWT vence se corta la conexión y el panel
 * vuelve a conectarse con el token renovado. Evento: `posiciones` con PosicionMaquina[].
 */
@WebSocketGateway({ namespace: '/tracking', cors: { origin: true } })
export class TrackingGateway implements OnGatewayInit, PublicadorPosicionesPort {
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  private readonly servidor: Namespace;

  constructor(private readonly jwtService: JwtService) {}

  afterInit(servidor: Namespace) {
    servidor.use((cliente: Socket, next) => {
      try {
        const token: unknown = cliente.handshake.auth?.token;
        if (typeof token !== 'string') throw new Error('Sin token');
        const { exp } = this.jwtService.verify<{ exp?: number }>(token);
        if (exp) {
          const vence = setTimeout(() => cliente.disconnect(true), exp * 1000 - Date.now());
          cliente.once('disconnect', () => clearTimeout(vence));
        }
        next();
      } catch {
        next(new Error('NO_AUTORIZADO'));
      }
    });
  }

  publicar(posiciones: PosicionMaquina[]) {
    this.servidor.emit('posiciones', posiciones);
    this.logger.debug(`Publicadas ${posiciones.length} posiciones`);
  }
}
