-- Catálogo de modelos genéricos de máquina ("Datos Previos" al incorporar una máquina desde la app).
-- Tabla independiente, sin FKs: al elegir un modelo la app solo copia marca, modelo y tipo al formulario.
-- Aplicar una vez en bases creadas antes de este cambio (p. ej. Aiven). schema.sql ya la incluye.

CREATE TABLE IF NOT EXISTS MODELO_MAQUINA (
    id_modelo       SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL, -- nombre corto que se muestra en la app
    marca           VARCHAR(50) NOT NULL,
    modelo          VARCHAR(50) NOT NULL,
    tipo_maquina    VARCHAR(50) NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Un mismo modelo de fabricante no se repite, sin distinguir mayúsculas
CREATE UNIQUE INDEX IF NOT EXISTS ux_modelo_maquina_marca_modelo ON MODELO_MAQUINA (UPPER(marca), UPPER(modelo));

-- Modelos base de la flota actual (no se duplican si ya existen)
INSERT INTO modelo_maquina (nombre, marca, modelo, tipo_maquina) VALUES
('Cargador CAT 988K', 'Caterpillar', 'CAT 988K', 'Cargador Frontal'),
('Cargador CAT 980M', 'Caterpillar', 'CAT 980M', 'Cargador Frontal'),
('Cargador Komatsu WA600', 'Komatsu', 'WA600-6', 'Cargador Frontal'),
('Cargador Komatsu WA500', 'Komatsu', 'WA500-7', 'Cargador Frontal'),
('Excavadora CAT 390F', 'Caterpillar', 'CAT 390F L', 'Excavadora'),
('Excavadora Komatsu PC800', 'Komatsu', 'PC800LC-8', 'Excavadora'),
('Excavadora Komatsu PC490', 'Komatsu', 'PC490LC-11', 'Excavadora'),
('Bulldozer CAT D8T', 'Caterpillar', 'CAT D8T', 'Bulldozer'),
('Bulldozer CAT D9T', 'Caterpillar', 'CAT D9T', 'Bulldozer'),
('Bulldozer Komatsu D375A', 'Komatsu', 'D375A-6', 'Bulldozer'),
('Minicargador CAT 262D3', 'Caterpillar', 'CAT 262D3', 'Minicargador'),
('Minicargador Bobcat S770', 'Bobcat', 'S770', 'Minicargador'),
('Camión Tolva CAT 777G', 'Caterpillar', '777G', 'Camión Tolva'),
('Camión Tolva Komatsu HD785', 'Komatsu', 'HD785-7', 'Camión Tolva'),
('Motoniveladora CAT 16M3', 'Caterpillar', 'CAT 16M3', 'Motoniveladora'),
('Motoniveladora Komatsu GD655', 'Komatsu', 'GD655-7', 'Motoniveladora'),
('Retroexcavadora CAT 420F2', 'Caterpillar', 'CAT 420F2 4WD', 'Retroexcavadora')
ON CONFLICT DO NOTHING;
