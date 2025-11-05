import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'sow.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Database migration function
function migrateDatabase() {
  // Check if old columns exist and migrate
  try {
    const tableInfo = db.prepare("PRAGMA table_info(accounts)").all();
    const hasCompany = tableInfo.some(col => col.name === 'company');
    const hasAddress = tableInfo.some(col => col.name === 'address');
    const hasAccountContact = tableInfo.some(col => col.name === 'account_contact');
    const hasNotes = tableInfo.some(col => col.name === 'notes');

    if (hasCompany && !hasAccountContact) {
      console.log('Migrating: Renaming company to account_contact...');
      db.exec(`ALTER TABLE accounts RENAME COLUMN company TO account_contact`);
    }

    if (hasAddress && !hasNotes) {
      console.log('Migrating: Renaming address to notes...');
      db.exec(`ALTER TABLE accounts RENAME COLUMN address TO notes`);
    }
  } catch (err) {
    // Table doesn't exist yet, will be created
    console.log('No migration needed - creating fresh database');
  }
}

// Initialize database schema
function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      auth_provider TEXT DEFAULT 'local',
      azure_id TEXT UNIQUE,
      display_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // Accounts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      account_contact TEXT,
      email TEXT,
      phone TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      content TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      portfolio TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Engagement Types table
  db.exec(`
    CREATE TABLE IF NOT EXISTS engagement_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // SOWs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      template_id INTEGER,
      product_id INTEGER,
      engagement_type_id INTEGER,
      project_notes TEXT NOT NULL,
      deliverables TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE SET NULL,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
      FOREIGN KEY (engagement_type_id) REFERENCES engagement_types (id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    )
  `);

  console.log('Database initialized successfully');
}

// Initialize the database
initializeDatabase();
migrateDatabase();

// User operations
export const userOps = {
  getAll: () => {
    const stmt = db.prepare('SELECT id, username, email, role, auth_provider, display_name, is_active, created_at, last_login FROM users ORDER BY created_at DESC');
    return stmt.all();
  },

  getById: (id) => {
    const stmt = db.prepare('SELECT id, username, email, role, auth_provider, display_name, is_active, created_at, last_login FROM users WHERE id = ?');
    return stmt.get(id);
  },

  getByUsername: (username) => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  },

  getByEmail: (email) => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  },

  getByAzureId: (azureId) => {
    const stmt = db.prepare('SELECT * FROM users WHERE azure_id = ?');
    return stmt.get(azureId);
  },

  create: (user) => {
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, auth_provider, azure_id, display_name, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      user.username,
      user.email,
      user.password_hash || null,
      user.role || 'user',
      user.auth_provider || 'local',
      user.azure_id || null,
      user.display_name || user.username,
      user.is_active !== undefined ? user.is_active : 1
    );
    return result.lastInsertRowid;
  },

  update: (id, user) => {
    const stmt = db.prepare(`
      UPDATE users
      SET username = ?, email = ?, role = ?, display_name = ?, is_active = ?
      WHERE id = ?
    `);
    stmt.run(
      user.username,
      user.email,
      user.role,
      user.display_name,
      user.is_active,
      id
    );
  },

  updatePassword: (id, passwordHash) => {
    const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    stmt.run(passwordHash, id);
  },

  updateLastLogin: (id) => {
    const stmt = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(id);
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(id);
  },

  countAdmins: () => {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1');
    return stmt.get('admin').count;
  }
};

// Account operations
export const accountOps = {
  getAll: () => {
    const stmt = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC');
    return stmt.all();
  },

  getById: (id) => {
    const stmt = db.prepare('SELECT * FROM accounts WHERE id = ?');
    return stmt.get(id);
  },

  create: (account) => {
    const stmt = db.prepare(`
      INSERT INTO accounts (name, account_contact, email, phone, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      account.name,
      account.account_contact || null,
      account.email || null,
      account.phone || null,
      account.notes || null
    );
    return result.lastInsertRowid;
  },

  update: (id, account) => {
    const stmt = db.prepare(`
      UPDATE accounts
      SET name = ?, account_contact = ?, email = ?, phone = ?, notes = ?
      WHERE id = ?
    `);
    stmt.run(
      account.name,
      account.account_contact || null,
      account.email || null,
      account.phone || null,
      account.notes || null,
      id
    );
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
    stmt.run(id);
  }
};

// Template operations
export const templateOps = {
  getAll: () => {
    const stmt = db.prepare('SELECT * FROM templates ORDER BY uploaded_at DESC');
    return stmt.all();
  },

  getById: (id) => {
    const stmt = db.prepare('SELECT * FROM templates WHERE id = ?');
    return stmt.get(id);
  },

  create: (template) => {
    const stmt = db.prepare(`
      INSERT INTO templates (name, file_path, file_type, content)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      template.name,
      template.file_path,
      template.file_type,
      template.content || null
    );
    return result.lastInsertRowid;
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM templates WHERE id = ?');
    stmt.run(id);
  }
};

// SOW operations
export const sowOps = {
  getAll: () => {
    const stmt = db.prepare(`
      SELECT s.*,
             a.name as account_name,
             a.account_contact as account_contact,
             t.name as template_name,
             p.name as product_name,
             et.name as engagement_type_name,
             u.username as created_by_username,
             u.display_name as created_by_display_name
      FROM sows s
      JOIN accounts a ON s.account_id = a.id
      LEFT JOIN templates t ON s.template_id = t.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN engagement_types et ON s.engagement_type_id = et.id
      LEFT JOIN users u ON s.created_by = u.id
      ORDER BY s.created_at DESC
    `);
    return stmt.all();
  },

  getById: (id) => {
    const stmt = db.prepare(`
      SELECT s.*,
             a.name as account_name,
             a.account_contact as account_contact,
             t.name as template_name,
             p.name as product_name,
             et.name as engagement_type_name,
             u.username as created_by_username,
             u.display_name as created_by_display_name
      FROM sows s
      JOIN accounts a ON s.account_id = a.id
      LEFT JOIN templates t ON s.template_id = t.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN engagement_types et ON s.engagement_type_id = et.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ?
    `);
    return stmt.get(id);
  },

  getByAccountId: (accountId) => {
    const stmt = db.prepare(`
      SELECT s.*, t.name as template_name
      FROM sows s
      LEFT JOIN templates t ON s.template_id = t.id
      WHERE s.account_id = ?
      ORDER BY s.created_at DESC
    `);
    return stmt.all(accountId);
  },

  create: (sow) => {
    const stmt = db.prepare(`
      INSERT INTO sows (account_id, template_id, product_id, engagement_type_id, project_notes, deliverables, content, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      sow.account_id,
      sow.template_id || null,
      sow.product_id || null,
      sow.engagement_type_id || null,
      sow.project_notes,
      sow.deliverables,
      sow.content,
      sow.created_by || null
    );
    return result.lastInsertRowid;
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM sows WHERE id = ?');
    stmt.run(id);
  }
};

// Product operations
export const productOps = {
  getAll: () => {
    const stmt = db.prepare('SELECT * FROM products ORDER BY created_at DESC');
    return stmt.all();
  },

  getById: (id) => {
    const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
    return stmt.get(id);
  },

  create: (product) => {
    const stmt = db.prepare(`
      INSERT INTO products (name, portfolio, description)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(
      product.name,
      product.portfolio || null,
      product.description || null
    );
    return result.lastInsertRowid;
  },

  update: (id, product) => {
    const stmt = db.prepare(`
      UPDATE products
      SET name = ?, portfolio = ?, description = ?
      WHERE id = ?
    `);
    stmt.run(
      product.name,
      product.portfolio || null,
      product.description || null,
      id
    );
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM products WHERE id = ?');
    stmt.run(id);
  }
};

// Engagement Type operations
export const engagementTypeOps = {
  getAll: () => {
    const stmt = db.prepare('SELECT * FROM engagement_types ORDER BY created_at DESC');
    return stmt.all();
  },

  getById: (id) => {
    const stmt = db.prepare('SELECT * FROM engagement_types WHERE id = ?');
    return stmt.get(id);
  },

  create: (engagementType) => {
    const stmt = db.prepare(`
      INSERT INTO engagement_types (name, category, description)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(
      engagementType.name,
      engagementType.category || null,
      engagementType.description || null
    );
    return result.lastInsertRowid;
  },

  update: (id, engagementType) => {
    const stmt = db.prepare(`
      UPDATE engagement_types
      SET name = ?, category = ?, description = ?
      WHERE id = ?
    `);
    stmt.run(
      engagementType.name,
      engagementType.category || null,
      engagementType.description || null,
      id
    );
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM engagement_types WHERE id = ?');
    stmt.run(id);
  }
};

export default db;
