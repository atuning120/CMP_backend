-- Metabase: la columna `estado` de reportes.v_estados_app deja de repetir la categoría ("Demora / Colación" -> "Colación");
-- la categoría ya está en `categoria_estado`. Solo cambia la view: estado_operacional.nombre sigue con el prefijo porque
-- la app lo muestra así y la migración 018 busca los estados por ese nombre completo.
-- Ojo: las preguntas de Metabase que filtran por el nombre con prefijo (p. ej. estado = 'Demora / Colación') hay que
-- cambiarlas al nombre sin prefijo.
-- Aplicar una vez en Azure y Aiven, después de la 016. schema.sql ya lo incluye. Es idempotente.

-- El ::VARCHAR(100) mantiene el tipo de la columna (regexp_replace devuelve text y CREATE OR REPLACE VIEW no deja
-- cambiar el tipo de una columna existente)
CREATE OR REPLACE VIEW reportes.v_estados_app AS
SELECT te.id_turno_estado,
       t.id_turno,
       t.id_maquina,
       m.nombre AS equipo,
       m.tipo_maquina AS categoria,
       t.fecha_turno AS fecha,
       regexp_replace(eo.nombre, '^[^/]+/\s*', '')::VARCHAR(100) AS estado,
       eo.categoria AS categoria_estado,
       eo.es_productivo,
       te.inicio,
       COALESCE(te.fin, t.hora_termino) AS fin,
       ROUND((EXTRACT(EPOCH FROM COALESCE(te.fin, t.hora_termino, CURRENT_TIMESTAMP) - te.inicio) / 3600)::numeric, 2) AS horas
FROM public.turno_estado te
JOIN public.turno t ON t.id_turno = te.id_turno
JOIN public.maquina m ON m.id_maquina = t.id_maquina
JOIN public.estado_operacional eo ON eo.id_estado = te.id_estado;

-- Verificación: ninguna fila debe conservar el prefijo
SELECT estado, categoria_estado, COUNT(*) AS filas
FROM reportes.v_estados_app
GROUP BY estado, categoria_estado
ORDER BY categoria_estado, estado;
