-- Agrega la acción LIBERAR al historial de auditoría.
-- Aplicar sobre una base creada antes de esta versión.
ALTER TABLE auditoria_eventos
  MODIFY accion ENUM('CREAR','EDITAR','ELIMINAR','RESTAURAR','LIBERAR') NOT NULL;
