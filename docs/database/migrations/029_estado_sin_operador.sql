-- Estado de máquina SIN_OPERADOR ("Sin operador"): el jefe de turno marca que la máquina está parada porque no hay
-- quien la opere. No tiene regreso estimado. Sí puede iniciar turno: al iniciarse, el Backend la pasa sola a ACTIVA
-- (y lo deja en la bitácora como CAMBIAR_ESTADO con motivo "Inicio de turno").
-- La etiqueta calculada "Sin asignar" (nadie la tiene asignada ni en turno) sigue sin guardarse.
-- Aplicar en Aiven y en Azure ANTES de desplegar el Backend que la usa. schema.sql ya la incluye. Es idempotente.

BEGIN;

-- Los CHECK de estado y de estado_previo_respaldo pueden tener otro nombre según cómo se creó la base: se buscan
-- por su definición (los dos listan EN_RESERVA) y se vuelven a crear con nombre fijo
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'maquina'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%EN_RESERVA%'
    LOOP
        EXECUTE format('ALTER TABLE maquina DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE maquina ADD CONSTRAINT maquina_estado_check
    CHECK (estado IN ('ACTIVA', 'BAJO_OBSERVACION', 'EN_MANTENIMIENTO', 'EN_RESERVA', 'SIN_OPERADOR', 'BAJA'));
ALTER TABLE maquina ADD CONSTRAINT ck_maquina_estado_previo_respaldo
    CHECK (estado_previo_respaldo IN ('ACTIVA', 'BAJO_OBSERVACION', 'EN_MANTENIMIENTO', 'EN_RESERVA', 'SIN_OPERADOR', 'BAJA'));

COMMIT;

-- Comprobación: deben salir los dos constraints con SIN_OPERADOR
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'maquina'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%SIN_OPERADOR%';
