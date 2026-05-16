-- SQLite Migration for Centralized RBAC Engine

-- Create roles
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  description TEXT,
  is_immutable INTEGER DEFAULT 0
);

-- Store modules scoping
CREATE TABLE IF NOT EXISTS permission_modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  scope TEXT CHECK(scope IN ('K', 'P', 'BOTH'))
);

-- Store pages mapping to modules
CREATE TABLE IF NOT EXISTS permission_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER,
  name TEXT,
  FOREIGN KEY(module_id) REFERENCES permission_modules(id)
);

-- Store components inside pages
CREATE TABLE IF NOT EXISTS permission_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER,
  name TEXT,
  FOREIGN KEY(page_id) REFERENCES permission_pages(id)
);

-- Store permissions
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER,
  action TEXT CHECK(action IN ('view', 'create', 'edit', 'delete', 'export', 'import', 'approve')),
  name TEXT UNIQUE, -- e.g., 'employee_master.employee_listing.edit_button.edit'
  FOREIGN KEY(component_id) REFERENCES permission_components(id)
);

-- Map permissions to roles
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER,
  permission_id INTEGER,
  PRIMARY KEY(role_id, permission_id),
  FOREIGN KEY(role_id) REFERENCES roles(id),
  FOREIGN KEY(permission_id) REFERENCES permissions(id)
);

-- Role templates
CREATE TABLE IF NOT EXISTS role_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_template_permissions (
  template_id INTEGER,
  permission_id INTEGER,
  PRIMARY KEY(template_id, permission_id),
  FOREIGN KEY(template_id) REFERENCES role_templates(id),
  FOREIGN KEY(permission_id) REFERENCES permissions(id)
);

-- Alter users table (SQLite migration requires table recreation or ADD COLUMN depending on SQLite version. Assuming newer SQLite that supports ADD COLUMN for simple types, but for restructuring we use the standard copy-drop-rename pattern)

CREATE TABLE IF NOT EXISTS users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  username TEXT UNIQUE,
  password TEXT,
  role_id INTEGER,
  login_attempts INTEGER DEFAULT 0,
  is_locked INTEGER DEFAULT 0,
  lock_until DATETIME,
  mobile_number TEXT,
  birth_date DATE,
  secret_question_1 TEXT,
  secret_answer_1 TEXT,
  secret_question_2 TEXT,
  secret_answer_2 TEXT,
  FOREIGN KEY(role_id) REFERENCES roles(id)
);

INSERT INTO users_new (id, name, username, password) SELECT id, name, username, password FROM users;

-- For old 'admin' string roles, we can try to map them to an admin role_id via script later.
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Password recovery
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  token TEXT UNIQUE,
  expires_at DATETIME,
  is_used INTEGER DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT,
    record_id INTEGER,
    action TEXT,
    old_data TEXT,
    new_data TEXT,
    created_by INTEGER,
    modified_by INTEGER,
    deleted_by INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(modified_by) REFERENCES users(id),
    FOREIGN KEY(deleted_by) REFERENCES users(id)
);

-- Default SuperAdmin Role
INSERT INTO roles (name, description, is_immutable) VALUES ('SuperAdmin', 'Unrestricted System Access', 1);
-- Assign all existing users to SuperAdmin during migration for safety, or run a backend cleanup script.
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'SuperAdmin');
