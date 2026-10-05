-- =============================================================================
-- Datos sintéticos de prueba (Mina Los Colorados / Planta MLC)
-- Ejecutar después de schema.sql. Los 20 usuarios sintéticos no tienen password_hash;
-- para entrar a la app usar las cuentas del final del archivo.
-- =============================================================================

-- Inserción de 20 nuevos operadores en la tabla OPERADOR
INSERT INTO operador (nombre, apellido, rut, telefono, estado) VALUES
('Cristóbal', 'Mendoza', '13.101.452-9', '+56981234567', 'Identidad Validada'),
('Gabriel', 'Ríos', '13.102.893-1', '+56976543210', 'Identidad Validada'),
('Ignacio', 'Sepúlveda', '13.103.220-3', '+56965432109', 'Identidad Validada'),
('Valeria', 'Contreras', '13.104.561-4', '+56954321098', 'Identidad Validada'),
('Camila', 'Araya', '13.105.782-K', '+56943210987', 'Identidad Validada'),
('Sofía', 'Navarro', '13.106.310-2', '+56932109876', 'Identidad Validada'),
('Valentina', 'Espinosa', '13.107.945-8', '+56921098765', 'Identidad Validada'),
('Daniela', 'Bravo', '13.108.123-5', '+56910987654', 'Identidad Validada'),
('Carolina', 'Rojas', '13.109.654-0', '+56989012345', 'Identidad Validada'),
('Andrea', 'Fuentes', '13.110.876-7', '+56978901234', 'Identidad Validada'),
('Sebastián', 'Godoy', '13.111.432-1', '+56967890123', 'Identidad Validada'),
('Matías', 'Pizarro', '13.112.987-3', '+56956789012', 'Identidad Validada'),
('Felipe', 'Cárdenas', '13.113.159-6', '+56945678901', 'Identidad Validada'),
('Diego', 'Salazar', '13.114.753-2', '+56934567890', 'Identidad Validada'),
('Gonzalo', 'Orellana', '13.115.369-4', '+56923456789', 'Identidad Validada'),
('Hernán', 'Bustos', '13.116.842-0', '+56912345678', 'Identidad Validada'),
('Álvaro', 'Vergara', '13.117.210-8', '+56987654321', 'Identidad Validada'),
('Claudio', 'Gallardo', '13.118.635-7', '+56976543219', 'Identidad Validada'),
('Mauricio', 'Paredes', '13.119.481-5', '+56965432198', 'Identidad Validada'),
('Patricio', 'Santana', '13.120.934-2', '+56954321987', 'Identidad Validada');

-- Inserción de 20 registros en la tabla USUARIO
INSERT INTO usuario (email, nombre, rol, proveedor_auth, activo, id_operador, creado_en) VALUES
('gonzalo.rojas@empresa.cl', 'Gonzalo Rojas', 'ADMIN', 'CREDENCIALES', TRUE, 1, CURRENT_TIMESTAMP - INTERVAL '20 days'),
('matias.diaz@empresa.cl', 'Matías Díaz', 'VISOR', 'GOOGLE', TRUE, 2, CURRENT_TIMESTAMP - INTERVAL '19 days'),
('felipe.munoz@empresa.cl', 'Felipe Muñoz', 'VISOR', 'GOOGLE', TRUE, 3, CURRENT_TIMESTAMP - INTERVAL '18 days'),
('rodrigo.perez@empresa.cl', 'Rodrigo Pérez', 'ADMIN', 'CREDENCIALES', TRUE, 4, CURRENT_TIMESTAMP - INTERVAL '17 days'),
('diego.soto@empresa.cl', 'Diego Soto', 'VISOR', 'GOOGLE', TRUE, 5, CURRENT_TIMESTAMP - INTERVAL '16 days'),
('ignacio.contreras@empresa.cl', 'Ignacio Contreras', 'VISOR', 'CREDENCIALES', TRUE, 6, CURRENT_TIMESTAMP - INTERVAL '15 days'),
('esteban.silva@empresa.cl', 'Esteban Silva', 'VISOR', 'GOOGLE', TRUE, 7, CURRENT_TIMESTAMP - INTERVAL '14 days'),
('sebastian.martinez@empresa.cl', 'Sebastián Martínez', 'ADMIN', 'CREDENCIALES', TRUE, 8, CURRENT_TIMESTAMP - INTERVAL '13 days'),
('alejandro.sepulveda@empresa.cl', 'Alejandro Sepúlveda', 'VISOR', 'GOOGLE', TRUE, 9, CURRENT_TIMESTAMP - INTERVAL '12 days'),
('tomas.morales@empresa.cl', 'Tomás Morales', 'VISOR', 'CREDENCIALES', TRUE, 10, CURRENT_TIMESTAMP - INTERVAL '11 days'),
('joaquin.rodriguez@empresa.cl', 'Joaquín Rodríguez', 'VISOR', 'GOOGLE', TRUE, 11, CURRENT_TIMESTAMP - INTERVAL '10 days'),
('alvaro.lopez@empresa.cl', 'Álvaro López', 'VISOR', 'CREDENCIALES', TRUE, 12, CURRENT_TIMESTAMP - INTERVAL '9 days'),
('gabriel.fuentes@empresa.cl', 'Gabriel Fuentes', 'ADMIN', 'GOOGLE', TRUE, 13, CURRENT_TIMESTAMP - INTERVAL '8 days'),
('claudio.hernandez@empresa.cl', 'Claudio Hernández', 'VISOR', 'CREDENCIALES', TRUE, 14, CURRENT_TIMESTAMP - INTERVAL '7 days'),
('eduardo.torres@empresa.cl', 'Eduardo Torres', 'VISOR', 'GOOGLE', TRUE, 15, CURRENT_TIMESTAMP - INTERVAL '6 days'),
('marcelo.araya@empresa.cl', 'Marcelo Araya', 'VISOR', 'CREDENCIALES', TRUE, 16, CURRENT_TIMESTAMP - INTERVAL '5 days'),
('mauricio.flores@empresa.cl', 'Mauricio Flores', 'VISOR', 'GOOGLE', TRUE, 17, CURRENT_TIMESTAMP - INTERVAL '4 days'),
('hernan.espinoza@empresa.cl', 'Hernán Espinoza', 'VISOR', 'CREDENCIALES', TRUE, 18, CURRENT_TIMESTAMP - INTERVAL '3 days'),
('patricio.valenzuela@empresa.cl', 'Patricio Valenzuela', 'VISOR', 'GOOGLE', TRUE, 19, CURRENT_TIMESTAMP - INTERVAL '2 days'),
('ricardo.castillo@empresa.cl', 'Ricardo Castillo', 'ADMIN', 'CREDENCIALES', TRUE, 20, CURRENT_TIMESTAMP - INTERVAL '1 day');

-- Inserción de 20 registros sintéticos para la tabla AREA (Mina Los Colorados / Planta MLC)
INSERT INTO area (nombre, descripcion, poligono, estado, creado_en, modificado_en, modificado_por) VALUES
('Área 50 - Chancado Secundario', 'Reducción granulométrica primaria y secundaria de mineral de hierro', ST_GeomFromText('POLYGON((-70.7815 28.5110, -70.7805 28.5110, -70.7805 28.5100, -70.7815 28.5100, -70.7815 28.5110))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '20 days', NULL, NULL),
('Área 51 - Clasificación de Finos', 'Módulo de separación granulométrica mediante zarandas vibratorias', ST_GeomFromText('POLYGON((-70.7825 28.5120, -70.7815 28.5120, -70.7815 28.5110, -70.7825 28.5110, -70.7825 28.5120))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '19 days', NULL, NULL),
('Área 52 - Concentración Magnética', 'Línea de separadores magnéticos para incremento de ley de Fe', ST_GeomFromText('POLYGON((-70.7835 28.5130, -70.7825 28.5130, -70.7825 28.5120, -70.7835 28.5120, -70.7835 28.5130))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '18 days', NULL, NULL),
('Área 53 - Tambores Magnéticos', 'Batería de tambores de cobrado y limpieza de finos', ST_GeomFromText('POLYGON((-70.7845 28.5140, -70.7835 28.5140, -70.7835 28.5130, -70.7845 28.5130, -70.7845 28.5140))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '17 days', NULL, NULL),
('Área 54 - Planta de Tratamiento Rechazos', 'Procesamiento y recuperación de hierro a partir de colas', ST_GeomFromText('POLYGON((-70.7855 28.5150, -70.7845 28.5150, -70.7845 28.5140, -70.7855 28.5140, -70.7855 28.5150))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '16 days', NULL, NULL),
('Área 55 - Espesamiento de Pulpas', 'Clarificación de agua y acondicionamiento de densidad de pulpas', ST_GeomFromText('POLYGON((-70.7865 28.5160, -70.7855 28.5160, -70.7855 28.5150, -70.7865 28.5150, -70.7865 28.5160))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '15 days', NULL, NULL),
('Área 61 - Prensa de Rodillos (HPGR)', 'Molienda de alta presión para preparación de carga fina', ST_GeomFromText('POLYGON((-70.7875 28.5170, -70.7865 28.5170, -70.7865 28.5160, -70.7875 28.5160, -70.7875 28.5170))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '14 days', NULL, NULL),
('Área 82 - Acopio Sinter Feed', 'Canchas de almacenamiento final para despacho ferroviario', ST_GeomFromText('POLYGON((-70.7885 28.5180, -70.7875 28.5180, -70.7875 28.5170, -70.7885 28.5170, -70.7885 28.5180))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '13 days', NULL, NULL),
('Área 84 - Botadero de Estéril', 'Disposición final y acopio de material descarte no magnético', ST_GeomFromText('POLYGON((-70.7895 28.5190, -70.7885 28.5190, -70.7885 28.5180, -70.7895 28.5180, -70.7895 28.5190))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '12 days', NULL, NULL),
('Área 49 - Trazado Correas Principales', 'Red de correas transportadoras inter-áreas de mineral', ST_GeomFromText('POLYGON((-70.7905 28.5200, -70.7895 28.5200, -70.7895 28.5190, -70.7905 28.5190, -70.7905 28.5200))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '11 days', NULL, NULL),
('Área 10 - Taller de Mantenimiento IMOPAC', 'Infraestructura de soporte y mantenimiento de maquinaria pesada', ST_GeomFromText('POLYGON((-70.7915 28.5210, -70.7905 28.5210, -70.7905 28.5200, -70.7915 28.5200, -70.7915 28.5210))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '10 days', NULL, NULL),
('Área 12 - Estación de Combustible', 'Surtidor y abastecimiento de diésel para cargadores y bulldozers', ST_GeomFromText('POLYGON((-70.7925 28.5220, -70.7915 28.5220, -70.7915 28.5210, -70.7925 28.5210, -70.7925 28.5220))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '9 days', NULL, NULL),
('Área 15 - Stockpile Mineral Alta Ley', 'Zona de acopio estratégico de mineral grueso pre-chancado', ST_GeomFromText('POLYGON((-70.7935 28.5230, -70.7925 28.5230, -70.7925 28.5220, -70.7935 28.5220, -70.7935 28.5230))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '8 days', NULL, NULL),
('Área 18 - Garita Control Acceso Norte', 'Punto de control de ingreso y salida de equipos móviles', ST_GeomFromText('POLYGON((-70.7945 28.5240, -70.7935 28.5240, -70.7935 28.5230, -70.7945 28.5230, -70.7945 28.5240))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '7 days', NULL, NULL),
('Área 20 - Cancha de Reagregados', 'Plataforma para manipulación de colas y sobre-tamaños', ST_GeomFromText('POLYGON((-70.7955 28.5250, -70.7945 28.5250, -70.7945 28.5240, -70.7955 28.5240, -70.7955 28.5250))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '6 days', NULL, NULL),
('Área 22 - Estacionamiento Flota A', 'Lugar de descanso y cambio de turno para cargadores frontales', ST_GeomFromText('POLYGON((-70.7965 28.5260, -70.7955 28.5260, -70.7955 28.5250, -70.7965 28.5250, -70.7965 28.5260))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '5 days', NULL, NULL),
('Área 25 - Rampa Acceso Principal Rajo', 'Vía de alto tráfico para tránsito de camiones y maquinaria pesada', ST_GeomFromText('POLYGON((-70.7975 28.5270, -70.7965 28.5270, -70.7965 28.5260, -70.7975 28.5260, -70.7975 28.5270))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '4 days', NULL, NULL),
('Área 28 - Mantenimiento Neumáticos', 'Taller especializado para revisión y cambio de neumáticos', ST_GeomFromText('POLYGON((-70.7985 28.5280, -70.7975 28.5280, -70.7975 28.5270, -70.7985 28.5270, -70.7985 28.5280))', 4326), 'INACTIVA', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '1 day', 1),
('Área 30 - Pre-homogeneización Mineral', 'Cancha de mezcla de mineral para control de ley de alimentación', ST_GeomFromText('POLYGON((-70.7995 28.5290, -70.7985 28.5290, -70.7985 28.5280, -70.7995 28.5280, -70.7995 28.5290))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '2 days', NULL, NULL),
('Área 35 - Laboratorio Geológico MLC', 'Instalaciones de muestreo y control de calidad de mineral', ST_GeomFromText('POLYGON((-70.8005 28.5300, -70.7995 28.5300, -70.7995 28.5290, -70.8005 28.5290, -70.8005 28.5300))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL, NULL);

-- Inserción de 20 registros sintéticos en la tabla ZONA_TRABAJO
INSERT INTO zona_trabajo (id_area, nombre, descripcion, poligono, estado, creado_en, modificado_en, modificado_por) VALUES
(1, 'Subzona Tolva de Alimentación 01', 'Plataforma de descarga directa para cargadores frontales', ST_GeomFromText('POLYGON((-70.7814 28.5109, -70.7809 28.5109, -70.7809 28.5104, -70.7814 28.5104, -70.7814 28.5109))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '20 days', NULL, NULL),
(1, 'Cancha de Stacking Pre-Chancado', 'Zona de acumulación temporal de mineral grueso', ST_GeomFromText('POLYGON((-70.7812 28.5108, -70.7807 28.5108, -70.7807 28.5103, -70.7812 28.5103, -70.7812 28.5108))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '19 days', NULL, NULL),
(2, 'Módulo de Cribado Fino A', 'Punto de separación granulométrica mediante zarandas', ST_GeomFromText('POLYGON((-70.7824 28.5119, -70.7819 28.5119, -70.7819 28.5114, -70.7824 28.5114, -70.7824 28.5119))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '18 days', NULL, NULL),
(2, 'Zona Aseo Industrial Bajo Cintas', 'Sector asignado a cuadrillas de limpieza y apoyo', ST_GeomFromText('POLYGON((-70.7822 28.5118, -70.7817 28.5118, -70.7817 28.5113, -70.7822 28.5113, -70.7822 28.5118))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '17 days', NULL, NULL),
(3, 'Batería Separación Magnética 01', 'Tambores magnéticos para concentración primaria de hierro', ST_GeomFromText('POLYGON((-70.7834 28.5129, -70.7829 28.5129, -70.7829 28.5124, -70.7834 28.5124, -70.7834 28.5129))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '16 days', NULL, NULL),
(3, 'Plataforma Carga Limpieza Separadores', 'Zona operacional de apoyo con excavadoras y minicargadores', ST_GeomFromText('POLYGON((-70.7832 28.5128, -70.7827 28.5128, -70.7827 28.5123, -70.7832 28.5123, -70.7832 28.5128))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '15 days', NULL, NULL),
(4, 'Tambores Secundarios Nivel A', 'Circuito de concentración secundaria de alta intensidad', ST_GeomFromText('POLYGON((-70.7844 28.5139, -70.7839 28.5139, -70.7839 28.5134, -70.7844 28.5134, -70.7844 28.5139))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '14 days', NULL, NULL),
(4, 'Pasillo Inspección Técnica', 'Zona de tránsito peatonal y camionetas de supervisión', ST_GeomFromText('POLYGON((-70.7842 28.5138, -70.7837 28.5138, -70.7837 28.5133, -70.7842 28.5133, -70.7842 28.5138))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '13 days', NULL, NULL),
(5, 'Tolva Recepción Rechazos PTR', 'Punto de ingreso de colas para re-tratamiento', ST_GeomFromText('POLYGON((-70.7854 28.5149, -70.7849 28.5149, -70.7849 28.5144, -70.7854 28.5144, -70.7854 28.5149))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '12 days', NULL, NULL),
(5, 'Cancha Acopio Material Recuperado', 'Sector de acopio de concentrado recuperado', ST_GeomFromText('POLYGON((-70.7852 28.5148, -70.7847 28.5148, -70.7847 28.5143, -70.7852 28.5143, -70.7852 28.5148))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '11 days', NULL, NULL),
(6, 'Espesador de Pulpas N°1', 'Unidad de clarificación de agua e incremento de densidad', ST_GeomFromText('POLYGON((-70.7864 28.5159, -70.7859 28.5159, -70.7859 28.5154, -70.7864 28.5154, -70.7864 28.5159))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '10 days', NULL, NULL),
(6, 'Pileta Recuperación Agua Clara', 'Punto de bombeo de agua reciclada', ST_GeomFromText('POLYGON((-70.7862 28.5158, -70.7857 28.5158, -70.7857 28.5153, -70.7862 28.5153, -70.7862 28.5158))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '9 days', NULL, NULL),
(7, 'Alimentación Prensa Rodillos (HPGR)', 'Molienda de alta presión para acondicionamiento', ST_GeomFromText('POLYGON((-70.7874 28.5169, -70.7869 28.5169, -70.7869 28.5164, -70.7874 28.5164, -70.7874 28.5169))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '8 days', NULL, NULL),
(7, 'Cancha Acondicionamiento Carga', 'Área de acumulación de carga preparada para prensado', ST_GeomFromText('POLYGON((-70.7872 28.5168, -70.7867 28.5168, -70.7867 28.5163, -70.7872 28.5163, -70.7872 28.5168))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '7 days', NULL, NULL),
(8, 'Stockpile Sinter Feed Norte', 'Cancha principal de acopio para despacho ferroviario', ST_GeomFromText('POLYGON((-70.7884 28.5179, -70.7879 28.5179, -70.7879 28.5174, -70.7884 28.5174, -70.7884 28.5179))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '6 days', NULL, NULL),
(8, 'Cancha Cargamento Continuo Sur', 'Zona de operación de cargadores frontales', ST_GeomFromText('POLYGON((-70.7882 28.5178, -70.7877 28.5178, -70.7877 28.5173, -70.7882 28.5173, -70.7882 28.5178))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '5 days', NULL, NULL),
(9, 'Frente Apilamiento Botadero Estéril', 'Sector de descarga de material no magnético', ST_GeomFromText('POLYGON((-70.7894 28.5189, -70.7889 28.5189, -70.7889 28.5184, -70.7894 28.5184, -70.7894 28.5189))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '4 days', NULL, NULL),
(9, 'Rampa Nivelación Bulldozer', 'Plataforma para movimiento de tierra y empuje', ST_GeomFromText('POLYGON((-70.7892 28.5188, -70.7887 28.5188, -70.7887 28.5183, -70.7892 28.5183, -70.7892 28.5188))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '3 days', NULL, NULL),
(10, 'Correa Transportadora 01 - Tramo Inicial', 'Línea de transporte de mineral grueso', ST_GeomFromText('POLYGON((-70.7904 28.5199, -70.7899 28.5199, -70.7899 28.5194, -70.7904 28.5194, -70.7904 28.5199))', 4326), 'ACTIVA', CURRENT_TIMESTAMP - INTERVAL '2 days', NULL, NULL),
(10, 'Correa Transportadora 02 - Tramo Descarga', 'Correa de transferencia a canchas finales', ST_GeomFromText('POLYGON((-70.7902 28.5198, -70.7897 28.5198, -70.7897 28.5193, -70.7902 28.5193, -70.7902 28.5198))', 4326), 'MANTENCION', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP, 1);

-- Inserción corregida de 20 registros en AUDITORIA_GEOCERCA
INSERT INTO auditoria_geocerca (
    entidad,
    id_entidad,
    accion,
    poligono_anterior,
    id_usuario,
    fecha
) VALUES
('AREA', 1, 'CREAR', NULL, 1, CURRENT_TIMESTAMP - INTERVAL '20 days'),
('AREA', 2, 'CREAR', NULL, 1, CURRENT_TIMESTAMP - INTERVAL '19 days'),
('ZONA', 1, 'CREAR', NULL, 4, CURRENT_TIMESTAMP - INTERVAL '18 days'),
('ZONA', 2, 'CREAR', NULL, 4, CURRENT_TIMESTAMP - INTERVAL '17 days'),
('AREA', 1, 'EDITAR', ST_GeomFromText('POLYGON((-70.7816 28.5111, -70.7804 28.5111, -70.7804 28.5099, -70.7816 28.5099, -70.7816 28.5111))', 4326), 8, CURRENT_TIMESTAMP - INTERVAL '16 days'),
('AREA', 3, 'CREAR', NULL, 1, CURRENT_TIMESTAMP - INTERVAL '15 days'),
('ZONA', 3, 'CREAR', NULL, 8, CURRENT_TIMESTAMP - INTERVAL '14 days'),
('ZONA', 1, 'EDITAR', ST_GeomFromText('POLYGON((-70.7815 28.5110, -70.7810 28.5110, -70.7810 28.5105, -70.7815 28.5105, -70.7815 28.5110))', 4326), 4, CURRENT_TIMESTAMP - INTERVAL '13 days'),
('AREA', 4, 'CREAR', NULL, 13, CURRENT_TIMESTAMP - INTERVAL '12 days'),
('ZONA', 4, 'CREAR', NULL, 13, CURRENT_TIMESTAMP - INTERVAL '11 days'),
('AREA', 2, 'EDITAR', ST_GeomFromText('POLYGON((-70.7826 28.5121, -70.7814 28.5121, -70.7814 28.5109, -70.7826 28.5109, -70.7826 28.5121))', 4326), 20, CURRENT_TIMESTAMP - INTERVAL '10 days'),
('AREA', 5, 'CREAR', NULL, 1, CURRENT_TIMESTAMP - INTERVAL '9 days'),
('ZONA', 5, 'CREAR', NULL, 15, CURRENT_TIMESTAMP - INTERVAL '8 days'),
('ZONA', 2, 'EDITAR', ST_GeomFromText('POLYGON((-70.7823 28.5119, -70.7818 28.5119, -70.7818 28.5114, -70.7823 28.5114, -70.7823 28.5119))', 4326), 16, CURRENT_TIMESTAMP - INTERVAL '7 days'),
('AREA', 28, 'DESACTIVAR', ST_GeomFromText('POLYGON((-70.7985 28.5280, -70.7975 28.5280, -70.7975 28.5270, -70.7985 28.5270, -70.7985 28.5280))', 4326), 1, CURRENT_TIMESTAMP - INTERVAL '6 days'),
('ZONA', 20, 'EDITAR', ST_GeomFromText('POLYGON((-70.7903 28.5199, -70.7898 28.5199, -70.7898 28.5194, -70.7903 28.5194, -70.7903 28.5199))', 4326), 1, CURRENT_TIMESTAMP - INTERVAL '5 days'),
('AREA', 6, 'CREAR', NULL, 12, CURRENT_TIMESTAMP - INTERVAL '4 days'),
('ZONA', 6, 'CREAR', NULL, 17, CURRENT_TIMESTAMP - INTERVAL '3 days'),
('ZONA', 10, 'EDITAR', ST_GeomFromText('POLYGON((-70.7853 28.5149, -70.7848 28.5149, -70.7848 28.5144, -70.7853 28.5144, -70.7853 28.5149))', 4326), 19, CURRENT_TIMESTAMP - INTERVAL '2 days'),
('AREA', 7, 'CREAR', NULL, 1, CURRENT_TIMESTAMP - INTERVAL '1 day');

-- Inserción de 20 registros sintéticos para la tabla MAQUINA (Flota IMOPAC / Planta MLC)
INSERT INTO maquina (nombre, marca, modelo, anio, tipo_maquina, estado) VALUES
('CF-01', 'Caterpillar', 'CAT 988K High Lift', 2021, 'Cargador Frontal', 'ACTIVA'),
('CF-02', 'Caterpillar', 'CAT 988K Standard', 2022, 'Cargador Frontal', 'ACTIVA'),
('CF-03', 'Komatsu', 'WA600-6', 2020, 'Cargador Frontal', 'ACTIVA'),
('CF-04', 'Caterpillar', 'CAT 980M', 2019, 'Cargador Frontal', 'ACTIVA'),
('CF-05', 'Komatsu', 'WA500-7', 2023, 'Cargador Frontal', 'ACTIVA'),
('EX-01', 'Caterpillar', 'CAT 390F L', 2020, 'Excavadora', 'ACTIVA'),
('EX-02', 'Komatsu', 'PC800LC-8', 2021, 'Excavadora', 'ACTIVA'),
('EX-03', 'Caterpillar', 'CAT 349D2 L', 2018, 'Excavadora', 'BAJA'),
('EX-04', 'Komatsu', 'PC490LC-11', 2022, 'Excavadora', 'ACTIVA'),
('DZ-01', 'Caterpillar', 'CAT D8T', 2021, 'Bulldozer', 'ACTIVA'),
('DZ-02', 'Komatsu', 'D375A-6', 2020, 'Bulldozer', 'ACTIVA'),
('DZ-03', 'Caterpillar', 'CAT D9T', 2019, 'Bulldozer', 'ACTIVA'),
('DZ-04', 'Komatsu', 'D155AX-8', 2022, 'Bulldozer', 'BAJA'),
('MC-01', 'Caterpillar', 'CAT 262D3', 2021, 'Minicargador', 'ACTIVA'),
('MC-02', 'Bobcat', 'Bobcat S770', 2020, 'Minicargador', 'ACTIVA'),
('CT-01', 'Caterpillar', '777G', 2018, 'Camión Tolva', 'ACTIVA'),
('CT-02', 'Komatsu', 'HD785-7', 2019, 'Camión Tolva', 'ACTIVA'),
('MN-01', 'Caterpillar', 'CAT 16M3', 2021, 'Motoniveladora', 'ACTIVA'),
('MN-02', 'Komatsu', 'GD655-7', 2022, 'Motoniveladora', 'ACTIVA'),
('RX-01', 'Caterpillar', 'CAT 420F2 4WD', 2020, 'Retroexcavadora', 'ACTIVA');

-- Inserción de 20 registros sintéticos para la tabla DISPOSITIVO_GPS
INSERT INTO dispositivo_gps (imei, modelo, numero_sim, estado) VALUES
('864201040001001', 'Teltonika FMB920', '+56911000001', 'ACTIVO'),
('864201040001002', 'Teltonika FMB920', '+56911000002', 'ACTIVO'),
('864201040001003', 'Queclink GV300W', '+56911000003', 'ACTIVO'),
('864201040001004', 'Queclink GV300W', '+56911000004', 'MANTENIMIENTO'),
('864201040001005', 'Suntech ST3300', '+56911000005', 'ACTIVO'),
('864201040001006', 'CalAmp LMU-3030', '+56911000006', 'ACTIVO'),
('864201040001007', 'CalAmp LMU-3030', '+56911000007', 'ACTIVO'),
('864201040001008', 'Teltonika FMC130', '+56911000008', 'MANTENIMIENTO'),
('864201040001009', 'Teltonika FMC130', '+56911000009', 'ACTIVO'),
('864201040001010', 'Queclink GV58MG', '+56911000010', 'ACTIVO'),
('864201040001011', 'Queclink GV58MG', '+56911000011', 'ACTIVO'),
('864201040001012', 'Suntech ST3300', '+56911000012', 'ACTIVO'),
('864201040001013', 'Teltonika TAT100', '+56911000013', 'INACTIVO'),
('864201040001014', 'Teltonika FMB920', '+56911000014', 'ACTIVO'),
('864201040001015', 'Queclink GV300W', '+56911000015', 'ACTIVO'),
('864201040001016', 'CalAmp LMU-3030', '+56911000016', 'ACTIVO'),
('864201040001017', 'Teltonika FMC130', '+56911000017', 'ACTIVO'),
('864201040001018', 'Suntech ST3300', '+56911000018', 'ACTIVO'),
('864201040001019', 'Queclink GV58MG', '+56911000019', 'ACTIVO'),
('864201040001020', 'Teltonika TAT100', '+56911000020', 'ACTIVO');

-- Inserción de 20 registros sintéticos para la tabla ESTADO_OPERACIONAL
INSERT INTO estado_operacional (nombre, categoria, es_productivo, activo) VALUES
('Efectivo / Carguío y Excavación', 'PRODUCTIVO', TRUE, TRUE),
('Efectivo / Empuje y Nivelación', 'PRODUCTIVO', TRUE, TRUE),
('Efectivo / Traslado de Material', 'PRODUCTIVO', TRUE, TRUE),
('Efectivo / Peinado de Talud y Zanjado', 'PRODUCTIVO', TRUE, TRUE),
('Efectivo / Limpieza de Cancha y Pista', 'PRODUCTIVO', TRUE, TRUE),
('Demora / Relevo y Cambio de Turno', 'DEMORA', FALSE, TRUE),
('Demora / Colación y Descanso', 'DEMORA', FALSE, TRUE),
('Demora / Abastecimiento de Combustible', 'DEMORA', FALSE, TRUE),
('Demora / Traslado Interno Entre Zonas', 'DEMORA', FALSE, TRUE),
('Demora / Inspección Pre-Uso (Pre-Start)', 'DEMORA', FALSE, TRUE),
('Demora / Charla de Seguridad de 5 Minutos', 'DEMORA', FALSE, TRUE),
('Demora / Espera de Camión / Transporte', 'DEMORA', FALSE, TRUE),
('Demora / Limpieza Excesiva de Balde / Oruga', 'DEMORA', FALSE, TRUE),
('Mantención / Falla Mecánica Inesperada', 'MANTENCION', FALSE, TRUE),
('Mantención / Mantenimiento Programado', 'MANTENCION', FALSE, TRUE),
('Mantención / Reparación de Neumático / Oruga', 'MANTENCION', FALSE, TRUE),
('Mantención / Falla de Sistema Hidráulico', 'MANTENCION', FALSE, TRUE),
('Mantención / Revisión y Diagnóstico GPS', 'MANTENCION', FALSE, TRUE),
('Demora / Espera Despeje por Tronadura', 'DEMORA', FALSE, FALSE),
('Mantención / Inmovilizado por Siniestro', 'MANTENCION', FALSE, FALSE);

-- Inserción de 20 registros sintéticos para la tabla ASIGNACION_GPS
INSERT INTO asignacion_gps (
    id_gps, 
    id_maquina, 
    vigente_desde, 
    vigente_hasta
) VALUES
-- Asignaciones vigentes actuales (id_gps del 1 al 15 asignados a id_maquina del 1 al 15)
(1, 1, CURRENT_TIMESTAMP - INTERVAL '180 days', NULL),
(2, 2, CURRENT_TIMESTAMP - INTERVAL '150 days', NULL),
(3, 3, CURRENT_TIMESTAMP - INTERVAL '120 days', NULL),
(4, 4, CURRENT_TIMESTAMP - INTERVAL '200 days', NULL),
(5, 5, CURRENT_TIMESTAMP - INTERVAL '90 days', NULL),
(6, 6, CURRENT_TIMESTAMP - INTERVAL '210 days', NULL),
(7, 7, CURRENT_TIMESTAMP - INTERVAL '100 days', NULL),
(8, 8, CURRENT_TIMESTAMP - INTERVAL '300 days', NULL),
(9, 9, CURRENT_TIMESTAMP - INTERVAL '60 days', NULL),
(10, 10, CURRENT_TIMESTAMP - INTERVAL '140 days', NULL),
(11, 11, CURRENT_TIMESTAMP - INTERVAL '110 days', NULL),
(12, 12, CURRENT_TIMESTAMP - INTERVAL '80 days', NULL),
(13, 13, CURRENT_TIMESTAMP - INTERVAL '250 days', NULL),
(14, 14, CURRENT_TIMESTAMP - INTERVAL '40 days', NULL),
(15, 15, CURRENT_TIMESTAMP - INTERVAL '70 days', NULL),

-- Asignaciones históricas/finalizadas (reemplazos o mantenciones de dispositivos en id_maquina 16 al 20)
(16, 16, CURRENT_TIMESTAMP - INTERVAL '360 days', CURRENT_TIMESTAMP - INTERVAL '180 days'),
(17, 17, CURRENT_TIMESTAMP - INTERVAL '300 days', CURRENT_TIMESTAMP - INTERVAL '150 days'),
(18, 18, CURRENT_TIMESTAMP - INTERVAL '240 days', CURRENT_TIMESTAMP - INTERVAL '90 days'),
(19, 19, CURRENT_TIMESTAMP - INTERVAL '180 days', CURRENT_TIMESTAMP - INTERVAL '30 days'),
(20, 20, CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP - INTERVAL '10 days');

-- Inserción de 20 registros de telemetría GPS para la tabla TRACKING_HISTORY
INSERT INTO tracking_history (
    id_history,
    timestamp,
    id_gps,
    id_maquina,
    ubicacion,
    velocidad,
    heading,
    nivel_bateria,
    payload_crudo
) VALUES
(1001, CURRENT_TIMESTAMP - INTERVAL '120 minutes', 1, 1, ST_GeomFromText('POINT(-70.7814 28.5109)', 4326), 12.50, 180.00, 98.50, '{"satellites": 12, "engine_on": true, "voltage": 24.2}'),
(1002, CURRENT_TIMESTAMP - INTERVAL '114 minutes', 1, 1, ST_GeomFromText('POINT(-70.7812 28.5108)', 4326), 15.20, 185.50, 98.40, '{"satellites": 11, "engine_on": true, "voltage": 24.1}'),
(1003, CURRENT_TIMESTAMP - INTERVAL '108 minutes', 2, 2, ST_GeomFromText('POINT(-70.7824 28.5119)', 4326), 0.00, 90.00, 100.00, '{"satellites": 10, "engine_on": true, "voltage": 24.5}'),
(1004, CURRENT_TIMESTAMP - INTERVAL '102 minutes', 2, 2, ST_GeomFromText('POINT(-70.7822 28.5118)', 4326), 8.30, 95.00, 99.80, '{"satellites": 12, "engine_on": true, "voltage": 24.3}'),
(1005, CURRENT_TIMESTAMP - INTERVAL '96 minutes',  3, 3, ST_GeomFromText('POINT(-70.7834 28.5129)', 4326), 22.10, 270.00, 95.00, '{"satellites": 14, "engine_on": true, "voltage": 24.0}'),
(1006, CURRENT_TIMESTAMP - INTERVAL '90 minutes',  3, 3, ST_GeomFromText('POINT(-70.7832 28.5128)', 4326), 18.60, 265.00, 94.80, '{"satellites": 13, "engine_on": true, "voltage": 23.9}'),
(1007, CURRENT_TIMESTAMP - INTERVAL '84 minutes',  4, 4, ST_GeomFromText('POINT(-70.7844 28.5139)', 4326), 0.00, 0.00, 88.00, '{"satellites": 9, "engine_on": false, "voltage": 22.8}'),
(1008, CURRENT_TIMESTAMP - INTERVAL '78 minutes',  5, 5, ST_GeomFromText('POINT(-70.7854 28.5149)', 4326), 14.00, 45.00, 92.30, '{"satellites": 11, "engine_on": true, "voltage": 24.1}'),
(1009, CURRENT_TIMESTAMP - INTERVAL '72 minutes',  5, 5, ST_GeomFromText('POINT(-70.7852 28.5148)', 4326), 11.70, 50.20, 92.10, '{"satellites": 11, "engine_on": true, "voltage": 24.0}'),
(1010, CURRENT_TIMESTAMP - INTERVAL '66 minutes',  6, 6, ST_GeomFromText('POINT(-70.7864 28.5159)', 4326), 5.40, 135.00, 97.00, '{"satellites": 12, "engine_on": true, "voltage": 24.2}'),
(1011, CURRENT_TIMESTAMP - INTERVAL '60 minutes',  7, 7, ST_GeomFromText('POINT(-70.7874 28.5169)', 4326), 28.00, 310.00, 99.00, '{"satellites": 15, "engine_on": true, "voltage": 24.4}'),
(1012, CURRENT_TIMESTAMP - INTERVAL '54 minutes',  7, 7, ST_GeomFromText('POINT(-70.7872 28.5168)', 4326), 25.50, 312.00, 98.80, '{"satellites": 14, "engine_on": true, "voltage": 24.3}'),
(1013, CURRENT_TIMESTAMP - INTERVAL '48 minutes',  8, 8, ST_GeomFromText('POINT(-70.7884 28.5179)', 4326), 0.00, 180.00, 75.00, '{"satellites": 8, "engine_on": false, "voltage": 22.5}'),
(1014, CURRENT_TIMESTAMP - INTERVAL '42 minutes',  9, 9, ST_GeomFromText('POINT(-70.7894 28.5189)', 4326), 19.80, 225.00, 93.50, '{"satellites": 12, "engine_on": true, "voltage": 24.1}'),
(1015, CURRENT_TIMESTAMP - INTERVAL '36 minutes',  10, 10, ST_GeomFromText('POINT(-70.7904 28.5199)', 4326), 16.40, 10.00, 96.20, '{"satellites": 13, "engine_on": true, "voltage": 24.2}'),
(1016, CURRENT_TIMESTAMP - INTERVAL '30 minutes',  11, 11, ST_GeomFromText('POINT(-70.7915 28.5210)', 4326), 3.20, 15.50, 91.00, '{"satellites": 10, "engine_on": true, "voltage": 23.8}'),
(1017, CURRENT_TIMESTAMP - INTERVAL '24 minutes',  12, 12, ST_GeomFromText('POINT(-70.7925 28.5220)', 4326), 0.00, 0.00, 100.00, '{"satellites": 12, "engine_on": true, "voltage": 24.5}'),
(1018, CURRENT_TIMESTAMP - INTERVAL '18 minutes',  13, 13, ST_GeomFromText('POINT(-70.7935 28.5230)', 4326), 12.00, 80.00, 85.00, '{"satellites": 9, "engine_on": true, "voltage": 23.5}'),
(1019, CURRENT_TIMESTAMP - INTERVAL '12 minutes',  14, 14, ST_GeomFromText('POINT(-70.7945 28.5240)', 4326), 21.30, 190.00, 97.40, '{"satellites": 13, "engine_on": true, "voltage": 24.2}'),
(1020, CURRENT_TIMESTAMP - INTERVAL '6 minutes',   15, 15, ST_GeomFromText('POINT(-70.7955 28.5250)', 4326), 17.90, 195.00, 96.80, '{"satellites": 12, "engine_on": true, "voltage": 24.1}');

-- Inserción de 20 registros sintéticos para la tabla ALERTA
INSERT INTO alerta (
    id_gps, 
    id_maquina, 
    tipo, 
    fecha, 
    detalle, 
    atendida, 
    atendida_por, 
    atendida_en
) VALUES
(1, 1, 'EXCESO_VELOCIDAD', CURRENT_TIMESTAMP - INTERVAL '10 days', 'Velocidad detectada: 42 km/h en zona de tránsito límite 30 km/h', TRUE, 1, CURRENT_TIMESTAMP - INTERVAL '10 days' + INTERVAL '15 minutes'),
(2, 2, 'SALIDA_GEOCERCA', CURRENT_TIMESTAMP - INTERVAL '9 days', 'Equipo detectado fuera del área delimitada Planta MLC', TRUE, 1, CURRENT_TIMESTAMP - INTERVAL '9 days' + INTERVAL '30 minutes'),
(3, 3, 'RALENTI_EXCESIVO', CURRENT_TIMESTAMP - INTERVAL '9 days', 'Motor encendido sin movimiento durante más de 45 minutos continuos', TRUE, 4, CURRENT_TIMESTAMP - INTERVAL '9 days' + INTERVAL '1 hour'),
(4, 4, 'BATERIA_BAJA', CURRENT_TIMESTAMP - INTERVAL '8 days', 'Nivel de batería del dispositivo GPS cayó por debajo del 15%', FALSE, NULL, NULL),
(5, 5, 'DESCONEXION_GPS', CURRENT_TIMESTAMP - INTERVAL '8 days', 'Pérdida de señal de telemetría y comunicación con el servidor', TRUE, 8, CURRENT_TIMESTAMP - INTERVAL '8 days' + INTERVAL '2 hours'),
(6, 6, 'EXCESO_VELOCIDAD', CURRENT_TIMESTAMP - INTERVAL '7 days', 'Velocidad detectada: 38 km/h en rampa de acceso norte', TRUE, 4, CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '10 minutes'),
(7, 7, 'INGRESO_ZONA_NO_AUTORIZADA', CURRENT_TIMESTAMP - INTERVAL '7 days', 'Entrada detectada en sector de tronadura activa', TRUE, 1, CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '5 minutes'),
(8, 8, 'RALENTI_EXCESIVO', CURRENT_TIMESTAMP - INTERVAL '6 days', 'Motor en ralentí prolongado durante cambio de turno', FALSE, NULL, NULL),
(9, 9, 'IMPACTO_DETECTADO', CURRENT_TIMESTAMP - INTERVAL '6 days', 'Acelerómetro reporta evento G brusco en zona de acopio', TRUE, 13, CURRENT_TIMESTAMP - INTERVAL '6 days' + INTERVAL '20 minutes'),
(10, 10, 'SALIDA_GEOCERCA', CURRENT_TIMESTAMP - INTERVAL '5 days', 'Salida del perímetro de la Zona Chancado 01', TRUE, 13, CURRENT_TIMESTAMP - INTERVAL '5 days' + INTERVAL '45 minutes'),
(11, 11, 'EXCESO_VELOCIDAD', CURRENT_TIMESTAMP - INTERVAL '5 days', 'Velocidad detectada: 45 km/h en correa transportadora tramo 01', TRUE, 8, CURRENT_TIMESTAMP - INTERVAL '5 days' + INTERVAL '12 minutes'),
(12, 12, 'BATERIA_BAJA', CURRENT_TIMESTAMP - INTERVAL '4 days', 'Dispositivo operando con voltaje crítico de batería respaldo', FALSE, NULL, NULL),
(13, 13, 'RALENTI_EXCESIVO', CURRENT_TIMESTAMP - INTERVAL '4 days', 'Exceso de tiempo inactivo con motor encendido en Stockpile Sinter Feed', TRUE, 1, CURRENT_TIMESTAMP - INTERVAL '4 days' + INTERVAL '25 minutes'),
(14, 14, 'DESCONEXION_GPS', CURRENT_TIMESTAMP - INTERVAL '3 days', 'Interrupción imprevista de transmisión de datos', TRUE, 15, CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '40 minutes'),
(15, 15, 'EXCESO_VELOCIDAD', CURRENT_TIMESTAMP - INTERVAL '3 days', 'Velocidad detectada: 35 km/h en cancha de re-agregados', FALSE, NULL, NULL),
(16, 16, 'SALIDA_GEOCERCA', CURRENT_TIMESTAMP - INTERVAL '2 days', 'Equipo fuera de geocerca asignada en Botadero de Estéril', TRUE, 16, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '18 minutes'),
(17, 17, 'RALENTI_EXCESIVO', CURRENT_TIMESTAMP - INTERVAL '2 days', 'Equipo en ralentí durante colación sin apagar motor', TRUE, 20, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '50 minutes'),
(18, 18, 'INGRESO_ZONA_NO_AUTORIZADA', CURRENT_TIMESTAMP - INTERVAL '1 day', 'Ingreso de maquinaria a área bajo mantenimiento de neumáticos', FALSE, NULL, NULL),
(19, 19, 'IMPACTO_DETECTADO', CURRENT_TIMESTAMP - INTERVAL '1 day', 'Alarma por vibración y desaceleración en tolva de recepción', TRUE, 1, CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '8 minutes'),
(20, 20, 'EXCESO_VELOCIDAD', CURRENT_TIMESTAMP, 'Velocidad detectada: 40 km/h cerca de garita de acceso', FALSE, NULL, NULL);

-- Inserción de 20 registros sintéticos para la tabla TURNO
INSERT INTO turno (
    id_operador, 
    id_maquina, 
    fecha_turno, 
    hora_inicio, 
    hora_termino, 
    horometro_inicial, 
    horometro_final, 
    estado
) VALUES
(1,  1, '2026-09-01', '2026-09-01 08:00:00-03', '2026-09-01 18:00:00-03', 4520.50, 4530.50, 'CERRADO'),
(2,  2, '2026-09-01', '2026-09-01 08:00:00-03', '2026-09-01 18:30:00-03', 3120.00, 3130.50, 'CERRADO'),
(3,  3, '2026-09-01', '2026-09-01 08:00:00-03', '2026-09-01 18:00:00-03', 5890.10, 5900.10, 'CERRADO'),
(4,  4, '2026-09-01', '2026-09-01 08:00:00-03', '2026-09-01 17:45:00-03', 2140.00, 2149.75, 'CERRADO'),
(5,  5, '2026-09-01', '2026-09-01 20:00:00-03', '2026-09-02 06:00:00-03', 1200.00, 1210.00, 'CERRADO'),
(6,  6, '2026-09-01', '2026-09-01 20:00:00-03', '2026-09-02 06:15:00-03', 6430.25, 6440.50, 'CERRADO'),
(7,  7, '2026-09-02', '2026-09-02 08:00:00-03', '2026-09-02 18:00:00-03', 3890.00, 3900.00, 'CERRADO'),
(8,  8, '2026-09-02', '2026-09-02 08:00:00-03', '2026-09-02 18:20:00-03', 4120.50, 4130.80, 'CERRADO'),
(9,  9, '2026-09-02', '2026-09-02 20:00:00-03', '2026-09-03 06:00:00-03', 2980.00, 2990.00, 'CERRADO'),
(10, 10, '2026-09-02', '2026-09-02 20:00:00-03', '2026-09-03 06:00:00-03', 5110.30, 5120.30, 'CERRADO'),
(11, 11, '2026-09-03', '2026-09-03 08:00:00-03', '2026-09-03 18:00:00-03', 1850.00, 1860.00, 'CERRADO'),
(12, 12, '2026-09-03', '2026-09-03 08:00:00-03', '2026-09-03 18:10:00-03', 3420.00, 3430.10, 'CERRADO'),
(13, 13, '2026-09-03', '2026-09-03 20:00:00-03', '2026-09-04 06:00:00-03', 4900.00, 4910.00, 'CERRADO'),
(14, 14, '2026-09-03', '2026-09-03 20:00:00-03', '2026-09-04 06:00:00-03', 2730.40, 2740.40, 'CERRADO'),
(15, 15, '2026-09-04', '2026-09-04 08:00:00-03', '2026-09-04 18:00:00-03', 6120.00, 6130.00, 'CERRADO'),
(16, 16, '2026-09-04', '2026-09-04 08:00:00-03', '2026-09-04 18:30:00-03', 3950.50, 3961.00, 'CERRADO'),
(17, 17, '2026-09-04', '2026-09-04 20:00:00-03', '2026-09-05 06:00:00-03', 5310.00, 5320.00, 'CERRADO'),
(18, 18, '2026-09-04', '2026-09-04 20:00:00-03', '2026-09-05 06:00:00-03', 4180.20, 4190.20, 'CERRADO'),
(19, 19, '2026-09-28', '2026-09-28 08:00:00-03', NULL, 1500.00, NULL, 'EN_CURSO'),
(20, 20, '2026-09-28', '2026-09-28 08:00:00-03', NULL, 2840.50, NULL, 'EN_CURSO');

-- Inserción de 20 registros sintéticos para la tabla TURNO_UBICACION
INSERT INTO turno_ubicacion (
    id_turno, 
    id_area, 
    id_zona, 
    inicio, 
    fin
) VALUES
(1,  1,  1,  '2026-09-01 08:00:00-03', '2026-09-01 13:00:00-03'),
(1,  1,  2,  '2026-09-01 13:00:00-03', '2026-09-01 18:00:00-03'),
(2,  2,  3,  '2026-09-01 08:00:00-03', '2026-09-01 18:30:00-03'),
(3,  3,  5,  '2026-09-01 08:00:00-03', '2026-09-01 12:30:00-03'),
(3,  3,  6,  '2026-09-01 12:30:00-03', '2026-09-01 18:00:00-03'),
(4,  4,  7,  '2026-09-01 08:00:00-03', '2026-09-01 17:45:00-03'),
(5,  5,  9,  '2026-09-01 20:00:00-03', '2026-09-02 06:00:00-03'),
(6,  6,  11, '2026-09-01 20:00:00-03', '2026-09-02 06:15:00-03'),
(7,  7,  13, '2026-09-02 08:00:00-03', '2026-09-02 18:00:00-03'),
(8,  8,  15, '2026-09-02 08:00:00-03', '2026-09-02 18:20:00-03'),
(9,  9,  17, '2026-09-02 20:00:00-03', '2026-09-03 06:00:00-03'),
(10, 10, 19, '2026-09-02 20:00:00-03', '2026-09-03 06:00:00-03'),
(11, 1,  NULL, '2026-09-03 08:00:00-03', '2026-09-03 18:00:00-03'), -- id_zona opcional/nullable
(12, 2,  4,  '2026-09-03 08:00:00-03', '2026-09-03 18:10:00-03'),
(13, 3,  NULL, '2026-09-03 20:00:00-03', '2026-09-04 06:00:00-03'), -- id_zona opcional/nullable
(14, 4,  8,  '2026-09-03 20:00:00-03', '2026-09-04 06:00:00-03'),
(15, 5,  10, '2026-09-04 08:00:00-03', '2026-09-04 18:00:00-03'),
(16, 6,  12, '2026-09-04 08:00:00-03', '2026-09-04 18:30:00-03'),
(19, 9,  18, '2026-09-28 08:00:00-03', NULL), -- null si esta vigente (Turno 19 en curso)
(20, 10, 20, '2026-09-28 08:00:00-03', NULL); -- null si esta vigente (Turno 20 en curso)


-- Inserción de 20 registros sintéticos para la tabla TURNO_ESTADO
INSERT INTO turno_estado (
    id_turno, 
    id_estado, 
    inicio, 
    fin, 
    comentario
) VALUES
(1,  1,  '2026-09-01 08:00:00-03', '2026-09-01 13:00:00-03', 'Carguío de mineral en tolva principal sin novedades'),
(1,  7,  '2026-09-01 13:00:00-03', '2026-09-01 14:00:00-03', 'Pausa por horario de colación programada'),
(1,  1,  '2026-09-01 14:00:00-03', '2026-09-01 18:00:00-03', 'Continuación de labores productivas en chancado'),
(2,  2,  '2026-09-01 08:00:00-03', '2026-09-01 12:00:00-03', 'Empuje y nivelación de material en canchas'),
(2,  8,  '2026-09-01 12:00:00-03', '2026-09-01 12:30:00-03', 'Abastecimiento de combustible diésel en estación'),
(3,  3,  '2026-09-01 08:00:00-03', '2026-09-01 15:00:00-03', 'Traslado continuo de estéril hacia botadero'),
(3,  14, '2026-09-01 15:00:00-03', '2026-09-01 18:00:00-03', 'Detención por falla hidráulica en manguera principal'),
(4,  1,  '2026-09-01 08:00:00-03', '2026-09-01 17:45:00-03', 'Operación normal de excavación en zona de acopio'),
(5,  1,  '2026-09-01 20:00:00-03', '2026-09-02 01:00:00-03', 'Turno nocturno: alimentación de cinta transportadora'),
(5,  6,  '2026-09-01 01:00:00-03', '2026-09-01 01:30:00-03', 'Relevo y cambio de turno de personal'),
(6,  4,  '2026-09-01 20:00:00-03', '2026-09-02 06:15:00-03', 'Peinado de talud y zanjado de seguridad'),
(7,  5,  '2026-09-02 08:00:00-03', '2026-09-02 18:00:00-03', 'Limpieza general de canchas e infraestructura'),
(8,  1,  '2026-09-02 08:00:00-03', '2026-09-02 18:20:00-03', 'Carguío continuo de trenes en spólon sur'),
(9,  9,  '2026-09-02 20:00:00-03', '2026-09-02 21:00:00-03', 'Traslado interno entre áreas de la planta'),
(10, 15, '2026-09-02 20:00:00-03', '2026-09-03 02:00:00-03', 'Mantenimiento programado de motor y filtros'),
(11, 10, '2026-09-03 08:00:00-03', '2026-09-03 08:30:00-03', 'Inspección pre-uso (pre-start) y checklist'),
(12, 11, '2026-09-03 08:00:00-03', '2026-09-03 08:15:00-03', 'Asistencia a charla de seguridad de 5 minutos'),
(15, 1,  '2026-09-04 08:00:00-03', '2026-09-04 18:00:00-03', 'Carguío y extracción de mineral de alta ley'),
(19, 1,  '2026-09-28 08:00:00-03', NULL,                    'Estado actual: Operando en producción'),
(20, 12, '2026-09-28 08:00:00-03', NULL,                    'Estado actual: En espera por disponibilidad de camión');

-- Inserción de 20 registros sintéticos para la tabla REPORTE_TURNO
INSERT INTO reporte_turno (
    id_turno, 
    tipo, 
    descripcion, 
    fecha_hora, 
    estado_sincronizacion
) VALUES
(1,  'INICIO', 'Reporte de apertura de turno en Chancado Secundario. Checklist inicial completado.', '2026-09-01 08:00:00-03', 'SINCRONIZADO'),
(1,  'FIN',    'Cierre de turno sin novedades. Equipo cargado y estacionado en sector asignado.',   '2026-09-01 18:00:00-03', 'SINCRONIZADO'),
(2,  'INICIO', 'Inicio de turno en Cancha Stacking. Inspección pre-start efectuada.',             '2026-09-01 08:00:00-03', 'SINCRONIZADO'),
(2,  'FIN',    'Cierre de turno. Sin novedades operativas.',                                       '2026-09-01 18:30:00-03', 'SINCRONIZADO'),
(3,  'INICIO', 'Apertura de turno en Módulo Cribado. Nivel de fluidos verificado.',                '2026-09-01 08:00:00-03', 'SINCRONIZADO'),
(3,  'FIN',    'Reporte de cierre. Detención por falla de manguera hidráulica a última hora.',      '2026-09-01 18:00:00-03', 'SINCRONIZADO'),
(4,  'INICIO', 'Recepción de máquina y reporte pre-uso correcto.',                                 '2026-09-01 08:00:00-03', 'SINCRONIZADO'),
(4,  'FIN',    'Término de jornada en Zona Limpieza Bajo Cintas. Sin incidentes.',                  '2026-09-01 17:45:00-03', 'SINCRONIZADO'),
(5,  'INICIO', 'Inicio de turno nocturno. Abastecimiento de combustible realizado.',               '2026-09-01 20:00:00-03', 'SINCRONIZADO'),
(5,  'FIN',    'Cierre de turno nocturno sin novedades.',                                          '2026-09-02 06:00:00-03', 'SINCRONIZADO'),
(6,  'INICIO', 'Apertura de turno. Equipo habilitado para tareas de zanjado.',                     '2026-09-01 20:00:00-03', 'SINCRONIZADO'),
(6,  'FIN',    'Cierre de turno. Inspección técnica de fin de jornada realizada.',                 '2026-09-02 06:15:00-03', 'SINCRONIZADO'),
(7,  'INICIO', 'Inicio de turno en Tambores Magnéticos.',                                          '2026-09-02 08:00:00-03', 'SINCRONIZADO'),
(7,  'FIN',    'Cierre de jornada. Limpieza de área efectuada.',                                   '2026-09-02 18:00:00-03', 'SINCRONIZADO'),
(8,  'INICIO', 'Inicio de turno en Pasillo Inspección.',                                           '2026-09-02 08:00:00-03', 'SINCRONIZADO'),
(8,  'FIN',    'Término de turno. Equipo entregado a pauta de mantenimiento.',                     '2026-09-02 18:20:00-03', 'SINCRONIZADO'),
(19, 'INICIO', 'Apertura de turno en curso. Reporte generado vía app móvil offline.',              '2026-09-28 08:00:00-03', 'PENDIENTE'),
(19, 'INICIO', 'Re-sincronización de apertura de turno desde servidor central.',                   '2026-09-28 08:05:00-03', 'SINCRONIZADO'),
(20, 'INICIO', 'Inicio de turno actual. Checklist pre-uso aprobado por supervisor.',               '2026-09-28 08:00:00-03', 'SINCRONIZADO'),
(20, 'FIN',    'Intento de reporte preliminar de cierre automático.',                              '2026-09-28 09:00:00-03', 'ERROR_SINCRONIZACION');

-- Inserción de 20 registros sintéticos para la tabla EVIDENCIA
INSERT INTO evidencia (
    id_reporte, 
    url_blob, 
    fecha_hora, 
    estado_sincronizacion
) VALUES
(1,  'https://storage.azure.com/mlc-evidencias/reportes/2026/09/01/rep1_prestart_01.jpg',   '2026-09-01 08:00:00-03', 'SINCRONIZADO'),
(1,  'https://storage.azure.com/mlc-evidencias/reportes/2026/09/01/rep1_horometro_01.jpg',  '2026-09-01 08:02:00-03', 'SINCRONIZADO'),
(2,  'https://storage.azure.com/mlc-evidencias/reportes/2026/09/01/rep2_oruga_derecha.jpg', '2026-09-01 18:00:00-03', 'SINCRONIZADO'),
(3,  'https://storage.azure.com/mlc-evidencias/reportes/2026/09/01/rep3_cancha_acopio.jpg', '2026-09-01 08:00:00-03', 'SINCRONIZADO'),
(4,  'https://storage.azure.com/mlc-evidencias/reportes/2026/09/01/rep4_horometro_fin.jpg', '2026-09-01 18:30:00-03', 'SINCRONIZADO'),
(5,  'https://storage.azure.com/mlc-evidencias/reportes/2026/09/01/rep5_criba_finos.jpg',   '2026-09-01 08:00:00-03', 'SINCRONIZADO'),
(6,  'https://storage.azure.com/mlc-evidencias/reportes/2026/09/01/rep6_falla_manguera.jpg', '2026-09-01 18:00:00-03', 'SINCRONIZADO'),
(7,  'https://storage.azure.com/mlc-evidencias/reportes/2026/09/01/rep7_balde_limpio.jpg',  '2026-09-01 08:00:00-03', 'SINCRONIZADO'),
(8,  'https://storage.azure.com/mlc-evidencias/reportes/2026/09/01/rep8_cierre_cintas.jpg',  '2026-09-01 17:45:00-03', 'SINCRONIZADO'),
(9,  'https://storage.azure.com/mlc-evidencias/reportes/2026/09/01/rep9_carga_diesel.jpg',  '2026-09-01 20:00:00-03', 'SINCRONIZADO'),
(10, 'https://storage.azure.com/mlc-evidencias/reportes/2026/09/02/rep10_estacionamiento.jpg','2026-09-02 06:00:00-03', 'SINCRONIZADO'),
(11, 'https://storage.azure.com/mlc-evidencias/reportes/2026/09/01/rep11_zanjado_norte.jpg','2026-09-01 20:00:00-03', 'SINCRONIZADO'),
(12, 'https://storage.azure.com/mlc-evidencias/reportes/2026/09/02/rep12_horometro_noche.jpg','2026-09-02 06:15:00-03', 'SINCRONIZADO'),
(13, 'https://storage.azure.com/mlc-evidencias/reportes/2026/09/02/rep13_tambores_mag.jpg', '2026-09-02 08:00:00-03', 'SINCRONIZADO'),
(14, 'https://storage.azure.com/mlc-evidencias/reportes/2026/09/02/rep14_limpieza_area.jpg', '2026-09-02 18:00:00-03', 'SINCRONIZADO'),
(15, 'https://storage.azure.com/mlc-evidencias/reportes/2026/09/02/rep15_pasillo_insp.jpg', '2026-09-02 08:00:00-03', 'SINCRONIZADO'),
(16, 'https://storage.azure.com/mlc-evidencias/reportes/2026/09/02/rep16_entrega_pauta.jpg','2026-09-02 18:20:00-03', 'SINCRONIZADO'),
(17, 'https://storage.azure.com/mlc-evidencias/reportes/2026/09/28/rep17_offline_app.jpg', '2026-09-28 08:00:00-03', 'PENDIENTE'),
(18, 'https://storage.azure.com/mlc-evidencias/reportes/2026/09/28/rep18_sync_server.jpg', '2026-09-28 08:05:00-03', 'SINCRONIZADO'),
(19, 'https://storage.azure.com/mlc-evidencias/reportes/2026/09/28/rep19_checklist_ok.jpg',  '2026-09-28 08:00:00-03', 'SINCRONIZADO');

-- =============================================================================
-- Cuentas de acceso a la app móvil (login online y, luego, offline)
-- Coinciden con los perfiles de acceso rápido de Front-mobile (src/data/initialData.ts).
-- password_hash = bcrypt (10 rondas, bcryptjs), igual que /auth/register/*:
--   cristian.nunez@cmp.cl / 12345          -> OPERADOR (también por RUT 15.123.456-7)
--   ana.rojas@cmp.cl      / miPassword123  -> JEFE_TURNO
-- El login por RUT exige OPERADOR.estado = 'ACTIVO'.
-- =============================================================================
INSERT INTO operador (nombre, apellido, rut, telefono, estado) VALUES
('Cristian', 'Núñez', '15.123.456-7', '+56912345678', 'ACTIVO');

INSERT INTO usuario (email, password_hash, nombre, rol, proveedor_auth, activo, id_operador) VALUES
('cristian.nunez@cmp.cl', '$2b$10$1JXHxZS4kex2ewivHKJpP.qnjqdZyJFqGpFgInXv9.O7ZrAlp3ld2', 'Cristian Núñez', 'OPERADOR', 'CREDENCIALES', TRUE,
  (SELECT id_operador FROM operador WHERE rut = '15.123.456-7')),
('ana.rojas@cmp.cl', '$2b$10$ClHyLi0S6n5jaksfiyGurO2dpKukR.RqoA5QXta7Gdifs6MrlyVhe', 'Ana Rojas', 'JEFE_TURNO', 'CREDENCIALES', TRUE, NULL);
