-- AQL y tipo de inspección en el catálogo de componentes.
-- Idempotente: no vuelve a agregar las columnas si ya existen.

SET @db := DATABASE();

SET @aql_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'componentes' AND COLUMN_NAME = 'aql'
);
SET @sql := IF(
  @aql_exists = 0,
  'ALTER TABLE componentes ADD COLUMN aql VARCHAR(40) NULL AFTER caracteristica_critica',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tipo_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'componentes' AND COLUMN_NAME = 'tipo_inspeccion'
);
SET @sql := IF(
  @tipo_exists = 0,
  'ALTER TABLE componentes ADD COLUMN tipo_inspeccion ENUM(''ESTRICTA'',''NORMAL'',''REDUCIDA'',''SKIP_LOT'') NULL AFTER aql',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
