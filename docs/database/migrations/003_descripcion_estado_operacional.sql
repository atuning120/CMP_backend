-- Descripción de cada estado operacional: la app la muestra en el botón "i" del panel de cambio de estado.
-- Aplicar una vez en bases creadas antes de este cambio (p. ej. Aiven). schema.sql ya la incluye.

ALTER TABLE ESTADO_OPERACIONAL ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- Descripciones de los estados del catálogo base (se identifican por nombre; los demás quedan sin descripción)
UPDATE estado_operacional e SET descripcion = d.descripcion
FROM (VALUES
  ('Efectivo / Carguío y Excavación', 'Carga de mineral o estéril en camiones, tolvas o trenes, y excavación de frentes. Es la actividad productiva principal del equipo.'),
  ('Efectivo / Empuje y Nivelación', 'Empuje de material con hoja y nivelación de canchas, rampas o plataformas de trabajo.'),
  ('Efectivo / Traslado de Material', 'Transporte de material con el propio equipo entre puntos de la faena (acopios, botaderos, tolvas).'),
  ('Efectivo / Peinado de Talud y Zanjado', 'Perfilado de taludes y construcción de zanjas de drenaje o seguridad.'),
  ('Efectivo / Limpieza de Cancha y Pista', 'Retiro de derrames y material suelto en canchas, pistas o bajo correas para mantener la operación.'),
  ('Demora / Relevo y Cambio de Turno', 'Entrega del equipo entre operadores al cambio de turno: traspaso de novedades y revisión rápida.'),
  ('Demora / Colación y Descanso', 'Pausa programada de colación o descanso del operador. El equipo queda detenido.'),
  ('Demora / Abastecimiento de Combustible', 'Traslado a la estación y carga de petróleo del equipo.'),
  ('Demora / Traslado Interno Entre Zonas', 'Desplazamiento del equipo sin carga entre áreas o zonas de trabajo, sin realizar labor productiva.'),
  ('Demora / Inspección Pre-Uso (Pre-Start)', 'Checklist de seguridad y revisión del equipo antes de comenzar a operar (niveles, luces, frenos, fugas).'),
  ('Demora / Charla de Seguridad de 5 Minutos', 'Charla de seguridad del inicio de turno o de una tarea específica.'),
  ('Demora / Espera de Camión / Transporte', 'Equipo disponible y operativo, pero detenido esperando camiones, tolva o tren para cargar.'),
  ('Demora / Limpieza Excesiva de Balde / Oruga', 'Detención para limpiar material adherido al balde, hoja u orugas que impide operar con normalidad.'),
  ('Demora / Espera Despeje por Tronadura', 'Equipo retirado del área y detenido mientras se realiza una tronadura y se autoriza el reingreso.'),
  ('Mantención / Falla Mecánica Inesperada', 'Detención por una avería mecánica no programada (motor, transmisión, frenos u otra).'),
  ('Mantención / Mantenimiento Programado', 'Mantención preventiva planificada según pauta del fabricante o del área de mantenimiento.'),
  ('Mantención / Reparación de Neumático / Oruga', 'Cambio o reparación de neumáticos u orugas dañados.'),
  ('Mantención / Falla de Sistema Hidráulico', 'Detención por fuga o falla del sistema hidráulico (mangueras, cilindros, bombas).'),
  ('Mantención / Revisión y Diagnóstico GPS', 'Revisión del dispositivo GPS o de telemetría del equipo.'),
  ('Mantención / Inmovilizado por Siniestro', 'Equipo detenido tras un incidente o accidente, a la espera de investigación o reparación.')
) AS d(nombre, descripcion)
WHERE e.nombre = d.nombre AND e.descripcion IS NULL;
