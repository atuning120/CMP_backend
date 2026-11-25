<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Configurar un GPS (Jimi LL301)

Cada máquina lleva un GPS Jimi LL301 (4G, a batería) que envía su posición por TCP con el protocolo GT06:

```
LL301 ── TCP 5023 ──▶ adaptador (VM) ── POST /tracking/posiciones ──▶ Backend ──▶ PostgreSQL + mapa web
```

El adaptador es el repo `CMP_adaptadorTCP`; en su README están el protocolo y el despliegue.

### 1. Antes de empezar

- El **IMEI** de la etiqueta del equipo (15 dígitos).
- Un **chip con datos y SMS**. Los comandos se envían por SMS al número de ese chip y terminan siempre en `#`.
- El equipo con batería y en un lugar con señal celular.
- Solo la primera vez en cada base de datos: la migración
  [`025_gps_por_maquina.sql`](docs/database/migrations/025_gps_por_maquina.sql), **antes** de desplegar el Backend.

### 2. Registrar y vincular en el panel web

Hacerlo antes de conectar el equipo: **las posiciones anteriores a la vinculación se descartan**. Lo puede hacer un jefe
de turno o un administrador, solo en el panel web (la app móvil no administra GPS).

1. **Flota → GPS → Registrar GPS**, con el IMEI. Si un dígito está mal copiado, lo rechaza.
2. **Vincular** el GPS a su máquina, con un motivo (queda en el historial).

### 3. Configurar el equipo por SMS

Enviar los comandos de a uno y esperar la respuesta antes del siguiente. Los datos del APN son los de Entel Chile; con
otra compañía se cambian por los suyos.

| # | Comando | Respuesta esperada |
|---|---|---|
| 1 | `PARAM#` | El IMEI del equipo: debe ser el registrado |
| 2 | `APN,imovil.entelpcs.cl,entelpcs,entelpcs#` | `APN set OK!` (el equipo se reinicia en 10 s: esperar un minuto) |
| 3 | `SERVER,0,57.156.71.98,5023,0#` | `SERVER set OK!` |
| 4 | `RESET#` | `The terminal will restart after 20 seconds!` |
| 5 | `STATUS#`, a los 2 o 3 minutos | Ya no debe decir `GPRS:Link Down` |

- `57.156.71.98` es la IP estática de la VM `cmp-adaptador-vm` (`cmp-adaptador.chilecentral.cloudapp.azure.com`). El
  `0` del principio indica que el servidor es una IP y el del final, TCP.
- **No enviar el comando `GMT`**: las tramas ya llegan en UTC, que es lo que espera el Backend. `PARAM#` muestra la zona
  horaria del equipo (por ejemplo `W,4,0 (AUTO)`) y no hay que cambiarla.
- Si `SERVER` responde un error, el equipo puede estar bloqueado a la plataforma del fabricante: pedir al proveedor que
  lo libere.

### 4. Comprobar

1. Al aire libre y en movimiento unos minutos, la máquina aparece en `/mapa`, tenga o no un turno.
2. En **Flota → GPS** se ven su última posición y su batería.
3. Si no aparece, mirar el log del adaptador en la VM: debe verse `Login <IMEI>` y después líneas `RX`.

   ```bash
   sudo docker logs -ft adaptador 2>&1 | grep -v 'Login 9'   # sin la app móvil
   ```

   Sin SSH:

   ```bash
   az vm run-command invoke -g CMP_Capstone -n cmp-adaptador-vm --command-id RunShellScript \
     --scripts 'docker logs -t --since 20m adaptador 2>&1 | grep <IMEI> | tail -40' --query "value[0].message" -o tsv
   ```

4. Para ver lo que se guardó:

   ```sql
   SELECT th."timestamp", m.nombre, ST_Y(th.ubicacion) AS lat, ST_X(th.ubicacion) AS lon, th.velocidad, th.nivel_bateria
   FROM tracking_history th
   JOIN dispositivo_gps d USING (id_gps)
   JOIN maquina m ON m.id_maquina = th.id_maquina
   WHERE d.imei = '<IMEI>'
   ORDER BY th."timestamp" DESC
   LIMIT 20;
   ```

### 5. Cambiar un GPS de máquina

Instalar el equipo en la otra máquina y usar **Flota → GPS → Cambiar**. No hay que volver a configurarlo por SMS. Si una
máquina con GPS se reemplaza en Flota, el panel ofrece pasar el GPS a la que entra. El recorrido anterior queda en la
máquina vieja y las posiciones desde el cambio van a la nueva, según la hora de cada posición.

### Cómo funciona

- **El GPS manda sobre el teléfono.** Mientras una máquina tiene un GPS real vinculado, se descartan las posiciones que
  la app móvil envía para ella. Al desvincularlo, la app vuelve a servir de GPS durante los turnos. Si el GPS se queda
  sin batería, el teléfono no lo reemplaza hasta desvincularlo.
- **Detenido, calla.** Quieto deja de enviar posiciones y puede dormirse por horas. Pasados 15 minutos, el mapa conserva
  su última posición atenuada, con el texto "Sin datos desde…" (hasta 7 días). No distingue una máquina detenida de un
  equipo sin batería o sin señal.
- **Sin conexión, guarda.** Las posiciones que no pudo enviar llegan al reconectarse, con su hora real y a veces
  desordenadas. Comprobado en un corte de pocos minutos; falta probar cortes largos y cuántas posiciones le caben. El
  Backend descarta las de más de 7 días y no duplica las repetidas.
- **Línea punteada en el trayecto:** más de 5 minutos sin posiciones. No es un recorrido real.
- **Por revisar** (Flota → GPS): más de 24 h sin reportar o batería de 20 % o menos.

### Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `GPRS:Link Down` | APN mal escrito, chip sin datos o sin señal | Repetir los comandos 2 a 4 y revisar el saldo del chip |
| No hay `Login <IMEI>` en el log | El equipo apunta a otro servidor, o el puerto no responde | Repetir `SERVER` y `RESET`; probar `nc -vz 57.156.71.98 5023` |
| Hay `Login` y posiciones, pero no aparece en el mapa | El IMEI no está registrado o vinculado | Flota → GPS. El log del Backend dice `posiciones no se guardaron` con el IMEI |
| Hay `Login` pero ninguna posición | Está detenido o sin cielo abierto | Moverlo al aire libre unos minutos |
| El log dice `la hora GPS difiere…` | Cambió la hora del equipo | Revisar si se envió `GMT` |
| La máquina se ve atenuada | No reporta hace más de 15 minutos | Normal si está detenida; si se mueve, revisar batería y señal |

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. Create a free account at [observe.nestjs.com](https://observe.nestjs.com), add an application, and paste the generated app key and secret into the `ObserveModule.forRoot()` call in `src/app.module.ts`.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
