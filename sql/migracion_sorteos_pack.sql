-- Estándar pack en sorteos especiales. Idempotente.

SET @db := DATABASE();

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sorteos_especiales'
    AND COLUMN_NAME = 'estandar_pack'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE sorteos_especiales ADD COLUMN estandar_pack INT UNSIGNED NULL AFTER serial_lote',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
