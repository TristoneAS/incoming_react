-- Incoming React — esquema MySQL
-- Interpreta el PDF "Actualización de Sistema Incoming":
--   1) Quejas (Programar, Registro, Checklist) con edición posterior
--   2) Sorteos Especiales (antes en Excel)
--   3) Revisión de Componentes + Registro de revisiones (con PDF)
-- Baja lógica en todos los registros operativos para eliminar y restaurar.

CREATE DATABASE IF NOT EXISTS incoming_react
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE incoming_react;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS adjuntos;
DROP TABLE IF EXISTS componente_semanas;
DROP TABLE IF EXISTS componente_revisiones;
DROP TABLE IF EXISTS componentes;
DROP TABLE IF EXISTS clasificacion_reglas;
DROP TABLE IF EXISTS sorteos_especiales;
DROP TABLE IF EXISTS quejas_checklist;
DROP TABLE IF EXISTS quejas_registros;
DROP TABLE IF EXISTS quejas_programas;
DROP TABLE IF EXISTS correos_notificacion;
DROP TABLE IF EXISTS auditoria_eventos;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Catálogo de reglas de inspección por clasificación (PDF p.14)
-- ---------------------------------------------------------------------------
CREATE TABLE clasificacion_reglas (
  clasificacion ENUM('AA','A','B','C','SLOW_MOVER') NOT NULL PRIMARY KEY,
  frecuencia VARCHAR(80) NOT NULL,
  metodo VARCHAR(80) NOT NULL,
  regla TEXT NOT NULL
) ENGINE=InnoDB;

INSERT INTO clasificacion_reglas (clasificacion, frecuencia, metodo, regla) VALUES
('AA', 'Según AQL 0.65%', 'Muestreo',
 'Material de alto volumen (proveída por Logística). Cada recibo se inspecciona según AQL 0.65%.'),
('A', 'Sólo por queja', 'Muestreo, según AQL 0.65%', 'Cada recibo se inspecciona.'),
('B', 'Sólo por queja', 'Muestreo, según AQL 0.65%', 'Cada recibo se inspecciona.'),
('C', 'Sólo por queja', 'Muestreo, según AQL 0.65%', 'Cada recibo se inspecciona.'),
('SLOW_MOVER', '1 vez al año', '5% lote',
 'Verificados una vez al año para su preservación y aseguramiento de que son óptimos para punto de uso.');

-- ---------------------------------------------------------------------------
-- Módulo QUEJAS — Programar inspección
-- Equivale a la tabla actual `programa`.
-- ---------------------------------------------------------------------------
CREATE TABLE quejas_programas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sap VARCHAR(40) NOT NULL,
  proveedor VARCHAR(120) NOT NULL,
  cliente VARCHAR(120) NOT NULL,
  plataforma VARCHAR(80) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  alerta_interna VARCHAR(120) NULL,
  periodo_inspeccion VARCHAR(80) NULL,
  comentario TEXT NULL,
  razon_queja VARCHAR(255) NULL,
  numero_queja VARCHAR(80) NULL,
  status ENUM('ACTIVO','LIBERADO') NOT NULL DEFAULT 'ACTIVO',
  creado_por VARCHAR(80) NULL,
  actualizado_por VARCHAR(80) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eliminado_en DATETIME NULL,
  eliminado_por VARCHAR(80) NULL,
  PRIMARY KEY (id),
  KEY idx_quejas_prog_sap (sap),
  KEY idx_quejas_prog_status (status, eliminado_en)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Módulo QUEJAS — Registro de Incoming
-- Equivale a la tabla actual `registros`.
-- ---------------------------------------------------------------------------
CREATE TABLE quejas_registros (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  programa_id INT UNSIGNED NOT NULL,
  empleado VARCHAR(80) NULL,
  serial_lote VARCHAR(80) NULL,
  piezas_totales INT UNSIGNED NOT NULL DEFAULT 0,
  piezas_ok INT UNSIGNED NOT NULL DEFAULT 0,
  piezas_nok INT UNSIGNED NOT NULL DEFAULT 0,
  fecha DATE NOT NULL,
  comentario TEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVO',
  creado_por VARCHAR(80) NULL,
  actualizado_por VARCHAR(80) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eliminado_en DATETIME NULL,
  eliminado_por VARCHAR(80) NULL,
  PRIMARY KEY (id),
  KEY idx_quejas_reg_programa (programa_id, eliminado_en),
  CONSTRAINT fk_quejas_reg_programa
    FOREIGN KEY (programa_id) REFERENCES quejas_programas (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Módulo QUEJAS — Checklist
-- Se elimina "última actualización" y "cost recovery pagado".
-- Se agrega fecha_cierre editable (calendario).
-- ---------------------------------------------------------------------------
CREATE TABLE quejas_checklist (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  programa_id INT UNSIGNED NOT NULL,
  embarque VARCHAR(120) NULL,
  ocho_disciplinas VARCHAR(120) NULL,
  acciones VARCHAR(255) NULL,
  queja VARCHAR(120) NULL,
  seguimiento_corporativo VARCHAR(120) NULL,
  sqe VARCHAR(120) NULL,
  comentario TEXT NULL,
  fecha DATE NULL,
  fecha_cierre DATE NULL,
  status ENUM('ACTIVO','LIBERADO') NOT NULL DEFAULT 'ACTIVO',
  usuario VARCHAR(80) NULL,
  actualizado_por VARCHAR(80) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eliminado_en DATETIME NULL,
  eliminado_por VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quejas_check_programa (programa_id),
  CONSTRAINT fk_quejas_check_programa
    FOREIGN KEY (programa_id) REFERENCES quejas_programas (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Módulo SORTEOS ESPECIALES
-- ---------------------------------------------------------------------------
CREATE TABLE sorteos_especiales (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  proveedor VARCHAR(120) NOT NULL,
  sap VARCHAR(40) NOT NULL,
  material VARCHAR(255) NOT NULL,
  fecha DATE NOT NULL,
  serial_lote VARCHAR(80) NULL,
  estandar_pack INT UNSIGNED NULL,
  piezas_totales INT UNSIGNED NOT NULL DEFAULT 0,
  piezas_ok INT UNSIGNED NOT NULL DEFAULT 0,
  piezas_nok INT UNSIGNED NOT NULL DEFAULT 0,
  comentario TEXT NULL,
  creado_por VARCHAR(80) NULL,
  actualizado_por VARCHAR(80) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eliminado_en DATETIME NULL,
  eliminado_por VARCHAR(80) NULL,
  PRIMARY KEY (id),
  KEY idx_sorteos_fecha (fecha, eliminado_en),
  KEY idx_sorteos_sap (sap)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Módulo REVISIÓN DE COMPONENTES — catálogo (pestaña maestra)
-- ---------------------------------------------------------------------------
CREATE TABLE componentes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sap VARCHAR(40) NOT NULL,
  categoria ENUM('NUEVO','SERIE','SLOW_MOVER') NOT NULL,
  estandar_pack VARCHAR(80) NULL,
  clasificacion ENUM('AA','A','B','C') NOT NULL,
  componente VARCHAR(255) NOT NULL,
  plataforma VARCHAR(80) NULL,
  caracteristica_critica TINYINT(1) NOT NULL DEFAULT 0,
  aql VARCHAR(40) NULL,
  tipo_inspeccion ENUM('ESTRICTA','NORMAL','REDUCIDA','SKIP_LOT') NOT NULL DEFAULT 'ESTRICTA',
  proveedor VARCHAR(120) NOT NULL,
  cliente VARCHAR(120) NULL,
  creado_por VARCHAR(80) NULL,
  actualizado_por VARCHAR(80) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eliminado_en DATETIME NULL,
  eliminado_por VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_componentes_sap (sap),
  KEY idx_componentes_clasif (clasificacion, categoria),
  CONSTRAINT fk_componentes_clasif
    FOREIGN KEY (clasificacion) REFERENCES clasificacion_reglas (clasificacion)
) ENGINE=InnoDB;

-- Letras de muestra nivel II y tamaños según Estricta / Normal / Reducida
CREATE TABLE aql_lote_letra (
  lote_min INT UNSIGNED NOT NULL,
  lote_max INT UNSIGNED NULL,
  letra CHAR(1) NOT NULL,
  PRIMARY KEY (lote_min)
) ENGINE=InnoDB;

INSERT INTO aql_lote_letra (lote_min, lote_max, letra) VALUES
  (2, 8, 'B'),
  (9, 15, 'B'),
  (16, 25, 'C'),
  (26, 50, 'D'),
  (51, 90, 'E'),
  (91, 150, 'F'),
  (151, 280, 'G'),
  (281, 400, 'H'),
  (401, 500, 'I'),
  (501, 1200, 'J'),
  (1201, 3200, 'K'),
  (3201, 10000, 'L'),
  (10001, 35000, 'M'),
  (35001, 150000, 'N'),
  (150001, 500000, 'P'),
  (500001, NULL, 'P');

CREATE TABLE aql_muestras_estricta (
  letra CHAR(1) NOT NULL,
  muestra INT UNSIGNED NOT NULL,
  PRIMARY KEY (letra)
) ENGINE=InnoDB;

INSERT INTO aql_muestras_estricta (letra, muestra) VALUES
  ('B', 3), ('C', 4), ('D', 5), ('E', 7), ('F', 10), ('G', 15),
  ('H', 20), ('I', 25), ('J', 35), ('K', 50), ('L', 75),
  ('M', 100), ('N', 150), ('P', 200);

CREATE TABLE aql_muestras_normal (
  letra CHAR(1) NOT NULL,
  muestra INT UNSIGNED NOT NULL,
  PRIMARY KEY (letra)
) ENGINE=InnoDB;

INSERT INTO aql_muestras_normal (letra, muestra) VALUES
  ('B', 3), ('C', 4), ('D', 5), ('E', 7), ('F', 10), ('G', 15),
  ('H', 20), ('I', 25), ('J', 35), ('K', 50), ('L', 75),
  ('M', 100), ('N', 150), ('P', 200);

CREATE TABLE aql_muestras_reducida (
  letra CHAR(1) NOT NULL,
  muestra INT UNSIGNED NOT NULL,
  PRIMARY KEY (letra)
) ENGINE=InnoDB;

INSERT INTO aql_muestras_reducida (letra, muestra) VALUES
  ('A', 2), ('B', 2), ('C', 2), ('D', 3), ('E', 5), ('F', 8),
  ('G', 13), ('H', 20), ('I', 32), ('J', 32), ('K', 50), ('L', 80),
  ('M', 125), ('N', 200), ('P', 315), ('Q', 500), ('R', 800);

-- ---------------------------------------------------------------------------
-- Registro de revisiones de componentes
-- Semana se deriva de la fecha (YEARWEEK). Color:
--   verde = revisión programada / conforme
--   rojo  = no conformidad, desviación o problema
-- ---------------------------------------------------------------------------
CREATE TABLE componente_revisiones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  componente_id INT UNSIGNED NULL,
  proveedor VARCHAR(120) NOT NULL,
  sap VARCHAR(40) NOT NULL,
  cliente VARCHAR(120) NULL,
  plataforma VARCHAR(80) NULL,
  caracteristica_critica TINYINT(1) NOT NULL DEFAULT 0,
  fecha DATE NOT NULL,
  anio SMALLINT UNSIGNED GENERATED ALWAYS AS (YEAR(fecha)) STORED,
  semana TINYINT UNSIGNED GENERATED ALWAYS AS (WEEK(fecha, 3)) STORED,
  serial_lote VARCHAR(80) NULL,
  tamano_lote INT UNSIGNED NULL,
  letra_muestra CHAR(1) NULL,
  muestra INT UNSIGNED NULL,
  sin_golpes ENUM('OK','NOK') NOT NULL,
  libre_quebraduras ENUM('OK','NOK') NOT NULL,
  sin_rebabas ENUM('OK','NOK') NOT NULL,
  sin_rayaduras ENUM('OK','NOK') NOT NULL,
  legible ENUM('OK','NOK') NOT NULL,
  sin_falta_subcomponentes ENUM('OK','NOK') NOT NULL,
  forma_adecuada ENUM('OK','NOK','NA') NOT NULL DEFAULT 'NA',
  dimensional ENUM('SI','NO') NOT NULL DEFAULT 'NO',
  comentario TEXT NULL,
  resultado ENUM('CONFORME','NO_CONFORME') NOT NULL DEFAULT 'CONFORME',
  notificado_sqe TINYINT(1) NOT NULL DEFAULT 0,
  creado_por VARCHAR(80) NULL,
  actualizado_por VARCHAR(80) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eliminado_en DATETIME NULL,
  eliminado_por VARCHAR(80) NULL,
  PRIMARY KEY (id),
  KEY idx_rev_componente (componente_id, eliminado_en),
  KEY idx_rev_semana (anio, semana, resultado),
  KEY idx_rev_sap (sap),
  CONSTRAINT fk_rev_componente
    FOREIGN KEY (componente_id) REFERENCES componentes (id)
) ENGINE=InnoDB;

-- Semana programada de revisión (indicador verde/rojo en calendario anual)
CREATE TABLE componente_semanas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  componente_id INT UNSIGNED NOT NULL,
  anio SMALLINT UNSIGNED NOT NULL,
  semana TINYINT UNSIGNED NOT NULL,
  estado ENUM('PROGRAMADA','CONFORME','NO_CONFORME') NOT NULL DEFAULT 'PROGRAMADA',
  revision_id INT UNSIGNED NULL,
  comentario TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_comp_semana (componente_id, anio, semana),
  CONSTRAINT fk_comp_sem_comp
    FOREIGN KEY (componente_id) REFERENCES componentes (id),
  CONSTRAINT fk_comp_sem_rev
    FOREIGN KEY (revision_id) REFERENCES componente_revisiones (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Adjuntos PDF (rebabas / dimensional / evidencias generales)
-- ---------------------------------------------------------------------------
CREATE TABLE adjuntos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  modulo ENUM('QUEJA','SORTEO','COMPONENTE','REVISION') NOT NULL,
  registro_id INT UNSIGNED NOT NULL,
  campo VARCHAR(60) NOT NULL,
  nombre_original VARCHAR(255) NOT NULL,
  ruta VARCHAR(500) NOT NULL,
  mime VARCHAR(80) NOT NULL DEFAULT 'application/pdf',
  bytes INT UNSIGNED NULL,
  creado_por VARCHAR(80) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eliminado_en DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_adjuntos_reg (modulo, registro_id, campo)
) ENGINE=InnoDB;

CREATE TABLE correos_notificacion (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  correo VARCHAR(180) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_correo (correo)
) ENGINE=InnoDB;

CREATE TABLE auditoria_eventos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  modulo VARCHAR(40) NOT NULL,
  registro_id INT UNSIGNED NOT NULL,
  accion ENUM('CREAR','EDITAR','ELIMINAR','RESTAURAR','LIBERAR') NOT NULL,
  usuario VARCHAR(80) NULL,
  detalle JSON NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_aud_mod (modulo, registro_id, creado_en)
) ENGINE=InnoDB;
