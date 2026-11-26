-- Cliente en el catálogo de componentes. Idempotente.

SET @db := DATABASE();

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'componentes' AND COLUMN_NAME = 'cliente'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE componentes ADD COLUMN cliente VARCHAR(120) NULL AFTER proveedor',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
