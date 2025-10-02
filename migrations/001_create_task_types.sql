-- Migración para crear la tabla task_types y agregar la relación a tasks
-- Fecha: 2025-01-10

-- 1. Crear tabla task_types
CREATE TABLE IF NOT EXISTS task_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_task_types_title (title)
);

-- 2. Insertar tipos de tarea por defecto
-- INSERT INTO task_types (title) VALUES 
--     ('Planificación'),
--     ('Ejecución'),
--     ('Seguimiento'),
--     ('Comunicación'),
--     ('Evaluación'),
--     ('Administración')
-- ON DUPLICATE KEY UPDATE title = VALUES(title);

-- 3. Agregar columna task_type_id a la tabla tasks
ALTER TABLE tasks 
ADD COLUMN task_type_id INT NOT NULL DEFAULT 1 AFTER created_by;

-- 4. Agregar foreign key constraint
ALTER TABLE tasks 
ADD CONSTRAINT fk_tasks_task_type 
FOREIGN KEY (task_type_id) REFERENCES task_types(id) 
ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Agregar índice para la nueva foreign key
CREATE INDEX idx_tasks_task_type_id ON tasks(task_type_id);

-- 6. Actualizar tareas existentes con tipos por defecto
UPDATE tasks SET task_type_id = 1 WHERE task_type_id = 1; -- Planificación por defecto
