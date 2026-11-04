-- Nuevo catálogo de estados operacionales (horas efectivas, demoras operacionales, mantención y fallas).
-- Los estados anteriores NO se borran: TURNO_ESTADO los referencia (historial, Excel, reportes). Se desactivan
-- (activo = FALSE), así dejan de aparecer en la app pero el historial conserva su nombre.
-- Los nuevos se insertan en el orden en que la app los lista (ORDER BY id_estado).
-- Aplicar una vez en Azure y Aiven. Es idempotente: se puede volver a correr sin duplicar estados.

BEGIN;

CREATE TEMP TABLE nuevo_catalogo (orden INT, nombre VARCHAR(100), categoria VARCHAR(30), descripcion TEXT) ON COMMIT DROP;

INSERT INTO nuevo_catalogo (orden, nombre, categoria, descripcion) VALUES
  -- Horas efectivas
  ( 1, 'Efectivo / Carga alimentación pila primaria', 'PRODUCTIVO', 'Carga de material para alimentar la pila primaria.'),
  ( 2, 'Efectivo / Rebaje de pila primaria', 'PRODUCTIVO', 'Rebaje y empuje de material de la pila primaria.'),
  ( 3, 'Efectivo / Rebaje de cono o acopio', 'PRODUCTIVO', 'Rebaje del cono de descarga o de un acopio de material.'),
  ( 4, 'Efectivo / Rebaje de piso o recuperación de pisos', 'PRODUCTIVO', 'Rebaje del piso de trabajo o recuperación de pisos con material acumulado.'),
  ( 5, 'Efectivo / Confección de plataforma y mejoras de piso', 'PRODUCTIVO', 'Construcción de plataformas de trabajo y mejora de pisos.'),
  ( 6, 'Efectivo / Mejora de caminos y piso', 'PRODUCTIVO', 'Mantención y mejora de caminos y pisos de tránsito.'),
  ( 7, 'Efectivo / Preparación de frente de carguío', 'PRODUCTIVO', 'Preparación y ordenamiento del frente donde se realiza el carguío.'),
  ( 8, 'Efectivo / Preparación de frente de acopio', 'PRODUCTIVO', 'Preparación del frente donde se acopia el material.'),
  ( 9, 'Efectivo / Carguío de tolvas', 'PRODUCTIVO', 'Carga de material en tolvas.'),
  (10, 'Efectivo / Carguío de camiones tolva', 'PRODUCTIVO', 'Carga de material en camiones tolva.'),
  (11, 'Efectivo / Excavaciones', 'PRODUCTIVO', 'Excavación de terreno o material.'),
  (12, 'Efectivo / Mejoramiento de talud', 'PRODUCTIVO', 'Perfilado y mejoramiento de taludes.'),
  (13, 'Efectivo / Confección de pretiles', 'PRODUCTIVO', 'Construcción de pretiles de seguridad.'),
  (14, 'Efectivo / Retiro de material', 'PRODUCTIVO', 'Retiro de material de un sector de trabajo.'),
  (15, 'Efectivo / Apoyo de instalación de cintas transportadoras', 'PRODUCTIVO', 'Apoyo con el equipo en la instalación de cintas transportadoras.'),
  -- Demoras operacionales
  (16, 'Demora / Relevo y cambio de turno', 'DEMORA', 'Entrega del equipo entre operadores al cambio de turno: traspaso de novedades y revisión rápida.'),
  (17, 'Demora / Colación', 'DEMORA', 'Pausa de colación del operador. El equipo queda detenido.'),
  (18, 'Demora / Espera de postura', 'DEMORA', 'Equipo detenido esperando que se le asigne o habilite la postura de trabajo.'),
  (19, 'Demora / Verificación en terreno', 'DEMORA', 'Equipo detenido mientras se verifican condiciones en terreno antes de operar.'),
  (20, 'Demora / Abastecimiento de combustible', 'DEMORA', 'Traslado a la estación y carga de petróleo del equipo.'),
  (21, 'Demora / Traslado interno entre zonas', 'DEMORA', 'Desplazamiento del equipo entre áreas o zonas de trabajo, sin realizar labor productiva.'),
  (22, 'Demora / Inspección pre-uso (checklist)', 'DEMORA', 'Checklist de seguridad y revisión del equipo antes de comenzar a operar (niveles, luces, frenos, fugas).'),
  (23, 'Demora / Charla de seguridad', 'DEMORA', 'Charla de seguridad del inicio de turno o de una tarea específica.'),
  (24, 'Demora / Espera de camión / transporte', 'DEMORA', 'Equipo disponible y operativo, pero detenido esperando camiones o transporte.'),
  -- Mantención y fallas
  (25, 'Mantención / Revisión y diagnóstico', 'MANTENCION', 'Revisión del equipo para diagnosticar una falla o anomalía.'),
  (26, 'Mantención / Mantenimiento programado', 'MANTENCION', 'Mantención preventiva planificada según pauta del fabricante o del área de mantenimiento.'),
  (27, 'Mantención / Mantenimiento rutinario', 'MANTENCION', 'Mantención de rutina del equipo (lubricación, ajustes, limpieza).'),
  (28, 'Mantención / Reparación correctiva', 'MANTENCION', 'Reparación de una falla o avería del equipo.');

-- 1. Desactivar todo estado que no esté en el nuevo catálogo
UPDATE estado_operacional e SET activo = FALSE
WHERE e.activo AND NOT EXISTS (SELECT 1 FROM nuevo_catalogo n WHERE n.nombre = e.nombre);

-- 2. Insertar los que faltan, en orden
INSERT INTO estado_operacional (nombre, categoria, es_productivo, activo, descripcion)
SELECT n.nombre, n.categoria, n.categoria = 'PRODUCTIVO', TRUE, n.descripcion
FROM nuevo_catalogo n
WHERE NOT EXISTS (SELECT 1 FROM estado_operacional e WHERE e.nombre = n.nombre)
ORDER BY n.orden;

-- 3. Si alguno ya existía (re-ejecución), dejarlo activo y con los datos del catálogo
UPDATE estado_operacional e
SET activo = TRUE, categoria = n.categoria, es_productivo = n.categoria = 'PRODUCTIVO', descripcion = n.descripcion
FROM nuevo_catalogo n
WHERE e.nombre = n.nombre;

COMMIT;

-- Verificación: deben salir 28 filas (15 PRODUCTIVO, 9 DEMORA, 4 MANTENCION), en ese orden
SELECT id_estado, categoria, nombre, es_productivo
FROM estado_operacional
WHERE activo
ORDER BY id_estado;
