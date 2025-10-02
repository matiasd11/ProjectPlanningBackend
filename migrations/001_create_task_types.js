const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Migración para crear la tabla task_types y agregar la relación a tasks
 * Ejecutar con: node migrations/001_create_task_types.js
 */

const runMigration = async () => {
  try {
    console.log('🚀 Iniciando migración: Crear tabla task_types...');

    // 1. Crear tabla task_types
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS task_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_task_types_title (title)
      )
    `, { type: QueryTypes.RAW });

    console.log('✅ Tabla task_types creada');

    // 2. Insertar tipos de tarea por defecto
    await sequelize.query(`
      INSERT INTO task_types (title) VALUES 
        ('Planificación'),
        ('Ejecución'),
        ('Seguimiento'),
        ('Comunicación'),
        ('Evaluación'),
        ('Administración')
      ON DUPLICATE KEY UPDATE title = VALUES(title)
    `, { type: QueryTypes.RAW });

    console.log('✅ Tipos de tarea insertados');

    // 3. Verificar si la columna task_type_id ya existe
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tasks' 
      AND COLUMN_NAME = 'task_type_id'
    `, { type: QueryTypes.SELECT });

    if (columns.length === 0) {
      // 4. Agregar columna task_type_id a la tabla tasks
      await sequelize.query(`
        ALTER TABLE tasks 
        ADD COLUMN task_type_id INT NOT NULL DEFAULT 1 AFTER created_by
      `, { type: QueryTypes.RAW });

      console.log('✅ Columna task_type_id agregada a tasks');

      // 5. Agregar foreign key constraint
      await sequelize.query(`
        ALTER TABLE tasks 
        ADD CONSTRAINT fk_tasks_task_type 
        FOREIGN KEY (task_type_id) REFERENCES task_types(id) 
        ON DELETE RESTRICT ON UPDATE CASCADE
      `, { type: QueryTypes.RAW });

      console.log('✅ Foreign key constraint agregado');

      // 6. Agregar índice para la nueva foreign key
      await sequelize.query(`
        CREATE INDEX idx_tasks_task_type_id ON tasks(task_type_id)
      `, { type: QueryTypes.RAW });

      console.log('✅ Índice agregado');
    } else {
      console.log('ℹ️  La columna task_type_id ya existe, saltando...');
    }

    console.log('🎉 Migración completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    throw error;
  }
};

// Ejecutar migración si se llama directamente
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Migración finalizada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
