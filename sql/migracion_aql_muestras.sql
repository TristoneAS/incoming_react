-- Letras de muestra (nivel II) y tamaños Estricta / Normal / Reducida.
-- Idempotente: CREATE IF NOT EXISTS + INSERT IGNORE + ALTER condicional.

CREATE TABLE IF NOT EXISTS aql_lote_letra (
  lote_min INT UNSIGNED NOT NULL,
  lote_max INT UNSIGNED NULL,
  letra CHAR(1) NOT NULL,
  PRIMARY KEY (lote_min)
) ENGINE=InnoDB;

INSERT IGNORE INTO aql_lote_letra (lote_min, lote_max, letra) VALUES
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

CREATE TABLE IF NOT EXISTS aql_muestras_estricta (
  letra CHAR(1) NOT NULL,
  muestra INT UNSIGNED NOT NULL,
  PRIMARY KEY (letra)
) ENGINE=InnoDB;

INSERT IGNORE INTO aql_muestras_estricta (letra, muestra) VALUES
  ('B', 3), ('C', 4), ('D', 5), ('E', 7), ('F', 10), ('G', 15),
  ('H', 20), ('I', 25), ('J', 35), ('K', 50), ('L', 75),
  ('M', 100), ('N', 150), ('P', 200);

CREATE TABLE IF NOT EXISTS aql_muestras_normal (
  letra CHAR(1) NOT NULL,
  muestra INT UNSIGNED NOT NULL,
  PRIMARY KEY (letra)
) ENGINE=InnoDB;

INSERT IGNORE INTO aql_muestras_normal (letra, muestra) VALUES
  ('B', 3), ('C', 4), ('D', 5), ('E', 7), ('F', 10), ('G', 15),
  ('H', 20), ('I', 25), ('J', 35), ('K', 50), ('L', 75),
  ('M', 100), ('N', 150), ('P', 200);

CREATE TABLE IF NOT EXISTS aql_muestras_reducida (
  letra CHAR(1) NOT NULL,
  muestra INT UNSIGNED NOT NULL,
  PRIMARY KEY (letra)
) ENGINE=InnoDB;

-- I no aparece en la tabla reducida: se usa el tamaño de J (32).
INSERT IGNORE INTO aql_muestras_reducida (letra, muestra) VALUES
  ('A', 2), ('B', 2), ('C', 2), ('D', 3), ('E', 5), ('F', 8),
  ('G', 13), ('H', 20), ('I', 32), ('J', 32), ('K', 50), ('L', 80),
  ('M', 125), ('N', 200), ('P', 315), ('Q', 500), ('R', 800);

SET @db := DATABASE();

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'componente_revisiones'
    AND COLUMN_NAME = 'tamano_lote'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE componente_revisiones ADD COLUMN tamano_lote INT UNSIGNED NULL AFTER serial_lote',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'componente_revisiones'
    AND COLUMN_NAME = 'letra_muestra'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE componente_revisiones ADD COLUMN letra_muestra CHAR(1) NULL AFTER tamano_lote',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'componente_revisiones'
    AND COLUMN_NAME = 'muestra'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE componente_revisiones ADD COLUMN muestra INT UNSIGNED NULL AFTER letra_muestra',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
