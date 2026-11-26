-- Catálogo mínimo requerido por la llave foránea de `componentes`.
-- Es idempotente: puede ejecutarse más de una vez.
INSERT INTO clasificacion_reglas (clasificacion, frecuencia, metodo, regla) VALUES
('AA', 'Según AQL 0.65%', 'Muestreo',
 'Material de alto volumen. Cada recibo se inspecciona según AQL 0.65%.'),
('A', 'Sólo por queja', 'Muestreo, según AQL 0.65%',
 'Cada recibo se inspecciona cuando existe una queja.'),
('B', 'Sólo por queja', 'Muestreo, según AQL 0.65%',
 'Cada recibo se inspecciona cuando existe una queja.'),
('C', 'Sólo por queja', 'Muestreo, según AQL 0.65%',
 'Cada recibo se inspecciona cuando existe una queja.'),
('SLOW_MOVER', '1 vez al año', '5% lote',
 'Verificación anual para preservación y disponibilidad en punto de uso.')
ON DUPLICATE KEY UPDATE
  frecuencia = VALUES(frecuencia),
  metodo = VALUES(metodo),
  regla = VALUES(regla);
