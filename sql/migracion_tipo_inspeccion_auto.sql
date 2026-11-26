-- El tipo de inspección inicia en ESTRICTA y se actualiza por racha de revisiones.
UPDATE componentes
SET tipo_inspeccion = 'ESTRICTA'
WHERE tipo_inspeccion IS NULL;

ALTER TABLE componentes
  MODIFY tipo_inspeccion ENUM('ESTRICTA','NORMAL','REDUCIDA','SKIP_LOT')
    NOT NULL DEFAULT 'ESTRICTA';
