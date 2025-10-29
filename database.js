import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'sow.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  // Accounts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
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

  // SOWs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      template_id INTEGER,
      project_notes TEXT NOT NULL,
      deliverables TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE SET NULL
    )
  `);

  console.log('Database initialized successfully');
}

// Initialize the database
initializeDatabase();

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
      INSERT INTO accounts (name, company, email, phone, address)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      account.name,
      account.company || null,
      account.email || null,
      account.phone || null,
      account.address || null
    );
    return result.lastInsertRowid;
  },

  update: (id, account) => {
    const stmt = db.prepare(`
      UPDATE accounts
      SET name = ?, company = ?, email = ?, phone = ?, address = ?
      WHERE id = ?
    `);
    stmt.run(
      account.name,
      account.company || null,
      account.email || null,
      account.phone || null,
      account.address || null,
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
      SELECT s.*, a.name as account_name, a.company as account_company,
             t.name as template_name
      FROM sows s
      JOIN accounts a ON s.account_id = a.id
      LEFT JOIN templates t ON s.template_id = t.id
      ORDER BY s.created_at DESC
    `);
    return stmt.all();
  },

  getById: (id) => {
    const stmt = db.prepare(`
      SELECT s.*, a.name as account_name, a.company as account_company,
             t.name as template_name
      FROM sows s
      JOIN accounts a ON s.account_id = a.id
      LEFT JOIN templates t ON s.template_id = t.id
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
      INSERT INTO sows (account_id, template_id, project_notes, deliverables, content)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      sow.account_id,
      sow.template_id || null,
      sow.project_notes,
      sow.deliverables,
      sow.content
    );
    return result.lastInsertRowid;
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM sows WHERE id = ?');
    stmt.run(id);
  }
};

export default db;
