-- Inicialización de la base de datos para Project Planning

-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role ENUM('admin', 'manager', 'user') DEFAULT 'user',
    bonita_user_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_bonita_user_id (bonita_user_id)
);

-- Crear tabla de proyectos
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    budget DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    status ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled') DEFAULT 'draft',
    category VARCHAR(100),
    manager_id INT,
    created_by INT NOT NULL,
    bonita_case_id VARCHAR(50),
    bonita_process_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_manager_id (manager_id),
    INDEX idx_bonita_case_id (bonita_case_id),
    INDEX idx_start_date (start_date)
);

-- Crear tabla de formularios de proyecto (campos adicionales)
CREATE TABLE IF NOT EXISTS project_forms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_value TEXT,
    field_type ENUM('text', 'number', 'date', 'boolean', 'json') DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE KEY unique_project_field (project_id, field_name),
    INDEX idx_project_id (project_id)
);

-- Crear tabla de comentarios/notas del proyecto
CREATE TABLE IF NOT EXISTS project_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    comment_type ENUM('note', 'approval', 'rejection', 'request') DEFAULT 'note',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_project_id (project_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- Crear tabla de archivos adjuntos
CREATE TABLE IF NOT EXISTS project_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_project_id (project_id)
);

-- Crear tabla de historial de estado del proyecto
CREATE TABLE IF NOT EXISTS project_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by INT NOT NULL,
    change_reason TEXT,
    bonita_task_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_project_id (project_id),
    INDEX idx_created_at (created_at)
);

-- Insertar usuario por defecto para desarrollo
INSERT IGNORE INTO users (username, email, password_hash, first_name, last_name, role, bonita_user_id) 
VALUES 
('admin', 'admin@projectplanning.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin', 'install'),
('manager', 'manager@projectplanning.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Manager', 'User', 'manager', NULL),
('user1', 'user1@projectplanning.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'John', 'Doe', 'user', NULL);

-- Insertar proyecto de ejemplo
INSERT IGNORE INTO projects (name, description, start_date, end_date, budget, priority, category, created_by) 
VALUES 
('Proyecto de Ejemplo', 'Este es un proyecto de ejemplo para demostración', '2025-01-01', '2025-12-31', 100000.00, 'medium', 'IT', 1);

COMMIT;