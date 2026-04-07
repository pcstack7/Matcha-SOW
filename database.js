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
    const hasIsActive = tableInfo.some(col => col.name === 'is_active');

    if (hasCompany && !hasAccountContact) {
      console.log('Migrating: Renaming company to account_contact...');
      db.exec(`ALTER TABLE accounts RENAME COLUMN company TO account_contact`);
    }

    if (hasAddress && !hasNotes) {
      console.log('Migrating: Renaming address to notes...');
      db.exec(`ALTER TABLE accounts RENAME COLUMN address TO notes`);
    }

    // Add is_active column to accounts if it doesn't exist
    if (!hasIsActive) {
      console.log('Migrating: Adding is_active column to accounts...');
      db.exec(`ALTER TABLE accounts ADD COLUMN is_active INTEGER DEFAULT 1`);
    }
  } catch (err) {
    // Table doesn't exist yet, will be created
    console.log('No migration needed - creating fresh database');
  }

  // Add is_active column to products if it doesn't exist
  try {
    const productTableInfo = db.prepare("PRAGMA table_info(products)").all();
    const hasIsActive = productTableInfo.some(col => col.name === 'is_active');

    if (!hasIsActive) {
      console.log('Migrating: Adding is_active column to products...');
      db.exec(`ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1`);
    }
  } catch (err) {
    console.log('Products table migration skipped');
  }

  // Add is_active column to engagement_types if it doesn't exist
  try {
    const engagementTypeTableInfo = db.prepare("PRAGMA table_info(engagement_types)").all();
    const hasIsActive = engagementTypeTableInfo.some(col => col.name === 'is_active');

    if (!hasIsActive) {
      console.log('Migrating: Adding is_active column to engagement_types...');
      db.exec(`ALTER TABLE engagement_types ADD COLUMN is_active INTEGER DEFAULT 1`);
    }
  } catch (err) {
    console.log('Engagement types table migration skipped');
  }

  // Add assumption_set_ids and out_of_scope_set_ids to sows if they don't exist
  try {
    const sowTableInfo = db.prepare("PRAGMA table_info(sows)").all();
    const hasAssumptionSetIds = sowTableInfo.some(col => col.name === 'assumption_set_ids');
    const hasOutOfScopeSetIds = sowTableInfo.some(col => col.name === 'out_of_scope_set_ids');

    if (!hasAssumptionSetIds) {
      console.log('Migrating: Adding assumption_set_ids column to sows...');
      db.exec(`ALTER TABLE sows ADD COLUMN assumption_set_ids TEXT`);
    }
    if (!hasOutOfScopeSetIds) {
      console.log('Migrating: Adding out_of_scope_set_ids column to sows...');
      db.exec(`ALTER TABLE sows ADD COLUMN out_of_scope_set_ids TEXT`);
    }
  } catch (err) {
    console.log('SOWs table migration skipped');
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
      is_active INTEGER DEFAULT 1,
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
      is_active INTEGER DEFAULT 1,
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
      is_active INTEGER DEFAULT 1,
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

  // Scope items table (assumptions and out-of-scope master items)
  db.exec(`
    CREATE TABLE IF NOT EXISTS scope_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('assumption', 'out_of_scope')),
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    )
  `);

  // Scope sets table (named sets of items)
  db.exec(`
    CREATE TABLE IF NOT EXISTS scope_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('assumption', 'out_of_scope')),
      description TEXT,
      is_locked INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    )
  `);

  // Scope set items junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scope_set_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      set_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (set_id) REFERENCES scope_sets (id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES scope_items (id) ON DELETE CASCADE
    )
  `);

  // Uploaded SOWs table (for SOW Knowledge Bank)
  db.exec(`
    CREATE TABLE IF NOT EXISTS uploaded_sows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      product_id INTEGER,
      engagement_type_id INTEGER,
      description TEXT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      matcha_file_id TEXT,
      pricing REAL,
      currency TEXT DEFAULT 'USD',
      pm_hours REAL,
      ic_hours REAL,
      sa_hours REAL,
      se_hours REAL,
      trainer_hours REAL,
      integration_hours REAL,
      apac_testing_hours REAL,
      apac_rd_hours REAL,
      created_by INTEGER NOT NULL,
      updated_by INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
      FOREIGN KEY (engagement_type_id) REFERENCES engagement_types (id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
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

  updateRole: (id, role) => {
    const stmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
    stmt.run(role, id);
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
  getAll: (filter = 'active') => {
    let whereClause = '';
    if (filter === 'active') {
      whereClause = 'WHERE is_active = 1';
    } else if (filter === 'inactive') {
      whereClause = 'WHERE is_active = 0';
    }
    // if filter === 'all', no WHERE clause needed

    const stmt = db.prepare(`SELECT * FROM accounts ${whereClause} ORDER BY created_at DESC`);
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

  deactivate: (id) => {
    const stmt = db.prepare(`
      UPDATE accounts
      SET is_active = 0
      WHERE id = ?
    `);
    stmt.run(id);
  },

  reactivate: (id) => {
    const stmt = db.prepare(`
      UPDATE accounts
      SET is_active = 1
      WHERE id = ?
    `);
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
      INSERT INTO sows (account_id, template_id, product_id, engagement_type_id, project_notes, deliverables, content, created_by, assumption_set_ids, out_of_scope_set_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      sow.account_id,
      sow.template_id || null,
      sow.product_id || null,
      sow.engagement_type_id || null,
      sow.project_notes,
      sow.deliverables,
      sow.content,
      sow.created_by || null,
      sow.assumption_set_ids || null,
      sow.out_of_scope_set_ids || null
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
  getAll: (filter = 'active') => {
    let whereClause = '';
    if (filter === 'active') {
      whereClause = 'WHERE is_active = 1';
    } else if (filter === 'inactive') {
      whereClause = 'WHERE is_active = 0';
    }
    // if filter === 'all', no WHERE clause needed

    const stmt = db.prepare(`SELECT * FROM products ${whereClause} ORDER BY created_at DESC`);
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

  deactivate: (id) => {
    const stmt = db.prepare(`
      UPDATE products
      SET is_active = 0
      WHERE id = ?
    `);
    stmt.run(id);
  },

  reactivate: (id) => {
    const stmt = db.prepare(`
      UPDATE products
      SET is_active = 1
      WHERE id = ?
    `);
    stmt.run(id);
  }
};

// Engagement Type operations
export const engagementTypeOps = {
  getAll: (filter = 'active') => {
    let whereClause = '';
    if (filter === 'active') {
      whereClause = 'WHERE is_active = 1';
    } else if (filter === 'inactive') {
      whereClause = 'WHERE is_active = 0';
    }
    // if filter === 'all', no WHERE clause needed

    const stmt = db.prepare(`SELECT * FROM engagement_types ${whereClause} ORDER BY created_at DESC`);
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

  deactivate: (id) => {
    const stmt = db.prepare(`
      UPDATE engagement_types
      SET is_active = 0
      WHERE id = ?
    `);
    stmt.run(id);
  },

  reactivate: (id) => {
    const stmt = db.prepare(`
      UPDATE engagement_types
      SET is_active = 1
      WHERE id = ?
    `);
    stmt.run(id);
  }
};

// Uploaded SOW operations
export const uploadedSOWOps = {
  getAll: (filter = 'active') => {
    let whereClause = '';
    if (filter === 'active') {
      whereClause = 'WHERE us.is_active = 1';
    } else if (filter === 'inactive') {
      whereClause = 'WHERE us.is_active = 0';
    }
    // if filter === 'all', no WHERE clause needed

    const stmt = db.prepare(`
      SELECT
        us.*,
        a.name as account_name,
        p.name as product_name,
        et.name as engagement_type_name,
        u.username as created_by_username,
        u.display_name as created_by_display_name,
        u2.username as updated_by_username,
        u2.display_name as updated_by_display_name
      FROM uploaded_sows us
      JOIN accounts a ON us.account_id = a.id
      LEFT JOIN products p ON us.product_id = p.id
      LEFT JOIN engagement_types et ON us.engagement_type_id = et.id
      LEFT JOIN users u ON us.created_by = u.id
      LEFT JOIN users u2 ON us.updated_by = u2.id
      ${whereClause}
      ORDER BY us.created_at DESC
    `);
    return stmt.all();
  },

  getById: (id) => {
    const stmt = db.prepare(`
      SELECT
        us.*,
        a.name as account_name,
        p.name as product_name,
        et.name as engagement_type_name,
        u.username as created_by_username,
        u.display_name as created_by_display_name,
        u2.username as updated_by_username,
        u2.display_name as updated_by_display_name
      FROM uploaded_sows us
      JOIN accounts a ON us.account_id = a.id
      LEFT JOIN products p ON us.product_id = p.id
      LEFT JOIN engagement_types et ON us.engagement_type_id = et.id
      LEFT JOIN users u ON us.created_by = u.id
      LEFT JOIN users u2 ON us.updated_by = u2.id
      WHERE us.id = ?
    `);
    return stmt.get(id);
  },

  create: (uploadedSOW) => {
    const stmt = db.prepare(`
      INSERT INTO uploaded_sows (
        account_id, product_id, engagement_type_id, description, file_name, file_path,
        matcha_file_id, pricing, currency, pm_hours, ic_hours, sa_hours, se_hours,
        trainer_hours, integration_hours, apac_testing_hours, apac_rd_hours, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      uploadedSOW.account_id,
      uploadedSOW.product_id || null,
      uploadedSOW.engagement_type_id || null,
      uploadedSOW.description || null,
      uploadedSOW.file_name,
      uploadedSOW.file_path,
      uploadedSOW.matcha_file_id || null,
      uploadedSOW.pricing || null,
      uploadedSOW.currency || 'USD',
      uploadedSOW.pm_hours || null,
      uploadedSOW.ic_hours || null,
      uploadedSOW.sa_hours || null,
      uploadedSOW.se_hours || null,
      uploadedSOW.trainer_hours || null,
      uploadedSOW.integration_hours || null,
      uploadedSOW.apac_testing_hours || null,
      uploadedSOW.apac_rd_hours || null,
      uploadedSOW.created_by
    );
    return result.lastInsertRowid;
  },

  update: (id, uploadedSOW) => {
    const stmt = db.prepare(`
      UPDATE uploaded_sows
      SET account_id = ?, product_id = ?, engagement_type_id = ?, description = ?,
          pricing = ?, currency = ?, pm_hours = ?, ic_hours = ?, sa_hours = ?, se_hours = ?,
          trainer_hours = ?, integration_hours = ?, apac_testing_hours = ?, apac_rd_hours = ?,
          updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      uploadedSOW.account_id,
      uploadedSOW.product_id || null,
      uploadedSOW.engagement_type_id || null,
      uploadedSOW.description || null,
      uploadedSOW.pricing || null,
      uploadedSOW.currency || 'USD',
      uploadedSOW.pm_hours || null,
      uploadedSOW.ic_hours || null,
      uploadedSOW.sa_hours || null,
      uploadedSOW.se_hours || null,
      uploadedSOW.trainer_hours || null,
      uploadedSOW.integration_hours || null,
      uploadedSOW.apac_testing_hours || null,
      uploadedSOW.apac_rd_hours || null,
      uploadedSOW.updated_by,
      id
    );
  },

  deactivate: (id, userId) => {
    const stmt = db.prepare(`
      UPDATE uploaded_sows
      SET is_active = 0, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(userId, id);
  },

  reactivate: (id, userId) => {
    const stmt = db.prepare(`
      UPDATE uploaded_sows
      SET is_active = 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(userId, id);
  },

  // Note: No delete operation - only deactivation/reactivation allowed
};

// Dashboard analytics operations
export const dashboardOps = {
  // Get total counts
  getCounts: () => {
    const stmt = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM sows) as total_generated_sows,
        (SELECT COUNT(*) FROM uploaded_sows WHERE is_active = 1) as total_uploaded_sows,
        (SELECT COUNT(*) FROM accounts) as total_accounts,
        (SELECT COUNT(*) FROM users WHERE is_active = 1) as total_users
    `);
    return stmt.get();
  },

  // Get pricing summary
  getPricingSummary: () => {
    const stmt = db.prepare(`
      SELECT
        currency,
        COUNT(*) as count,
        SUM(pricing) as total,
        AVG(pricing) as average,
        MIN(pricing) as minimum,
        MAX(pricing) as maximum
      FROM uploaded_sows
      WHERE is_active = 1 AND pricing IS NOT NULL
      GROUP BY currency
    `);
    return stmt.all();
  },

  // Get pricing by account
  getPricingByAccount: () => {
    const stmt = db.prepare(`
      SELECT
        a.name as account_name,
        us.currency,
        COUNT(us.id) as sow_count,
        SUM(us.pricing) as total_pricing
      FROM uploaded_sows us
      JOIN accounts a ON us.account_id = a.id
      WHERE us.is_active = 1 AND us.pricing IS NOT NULL
      GROUP BY a.id, us.currency
      ORDER BY total_pricing DESC
      LIMIT 10
    `);
    return stmt.all();
  },

  // Get pricing by product
  getPricingByProduct: () => {
    const stmt = db.prepare(`
      SELECT
        p.name as product_name,
        us.currency,
        COUNT(us.id) as sow_count,
        SUM(us.pricing) as total_pricing
      FROM uploaded_sows us
      JOIN products p ON us.product_id = p.id
      WHERE us.is_active = 1 AND us.pricing IS NOT NULL
      GROUP BY p.id, us.currency
      ORDER BY total_pricing DESC
    `);
    return stmt.all();
  },

  // Get pricing by user
  getPricingByUser: () => {
    const stmt = db.prepare(`
      SELECT
        u.display_name as user_name,
        us.currency,
        COUNT(us.id) as sow_count,
        SUM(us.pricing) as total_pricing
      FROM uploaded_sows us
      JOIN users u ON us.created_by = u.id
      WHERE us.is_active = 1 AND us.pricing IS NOT NULL
      GROUP BY u.id, us.currency
      ORDER BY total_pricing DESC
    `);
    return stmt.all();
  },

  // Get resource hours breakdown
  getResourceHoursBreakdown: () => {
    const stmt = db.prepare(`
      SELECT
        SUM(pm_hours) as pm_hours,
        SUM(ic_hours) as ic_hours,
        SUM(sa_hours) as sa_hours,
        SUM(se_hours) as se_hours,
        SUM(trainer_hours) as trainer_hours,
        SUM(integration_hours) as integration_hours,
        SUM(apac_testing_hours) as apac_testing_hours,
        SUM(apac_rd_hours) as apac_rd_hours
      FROM uploaded_sows
      WHERE is_active = 1
    `);
    return stmt.get();
  },

  // Get top accounts by SOW count
  getTopAccountsBySowCount: (limit = 10) => {
    const stmt = db.prepare(`
      SELECT
        a.name as account_name,
        COALESCE(generated.count, 0) + COALESCE(uploaded.count, 0) as sow_count,
        COALESCE(generated.count, 0) + COALESCE(uploaded.active_count, 0) as active_count
      FROM accounts a
      LEFT JOIN (
        SELECT account_id, COUNT(*) as count
        FROM sows
        GROUP BY account_id
      ) generated ON a.id = generated.account_id
      LEFT JOIN (
        SELECT account_id, COUNT(*) as count, COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_count
        FROM uploaded_sows
        GROUP BY account_id
      ) uploaded ON a.id = uploaded.account_id
      WHERE (COALESCE(generated.count, 0) + COALESCE(uploaded.count, 0)) > 0
      GROUP BY a.id
      ORDER BY sow_count DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  },

  // Get SOW creation timeline (last 12 months)
  getSowTimeline: () => {
    const stmt = db.prepare(`
      SELECT
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as generated_count
      FROM sows
      WHERE created_at >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month
    `);
    const generated = stmt.all();

    const uploadStmt = db.prepare(`
      SELECT
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as uploaded_count
      FROM uploaded_sows
      WHERE created_at >= date('now', '-12 months') AND is_active = 1
      GROUP BY month
      ORDER BY month
    `);
    const uploaded = uploadStmt.all();

    // Merge the two datasets
    const timeline = {};
    generated.forEach(item => {
      timeline[item.month] = { month: item.month, generated: item.generated_count, uploaded: 0 };
    });
    uploaded.forEach(item => {
      if (timeline[item.month]) {
        timeline[item.month].uploaded = item.uploaded_count;
      } else {
        timeline[item.month] = { month: item.month, generated: 0, uploaded: item.uploaded_count };
      }
    });

    return Object.values(timeline).sort((a, b) => a.month.localeCompare(b.month));
  },

  // Get engagement type distribution
  getEngagementTypeDistribution: () => {
    const stmt = db.prepare(`
      SELECT
        et.name as engagement_type,
        COUNT(us.id) as count
      FROM uploaded_sows us
      JOIN engagement_types et ON us.engagement_type_id = et.id
      WHERE us.is_active = 1
      GROUP BY et.id
      ORDER BY count DESC
    `);
    return stmt.all();
  },
};

// Scope item operations (assumptions and out-of-scope master items)
export const scopeItemOps = {
  getAll: (category, filter = 'active') => {
    // Conditions are applied on scope_items alone (inner subquery) to avoid
    // ambiguous column names when JOIN-ing with users (which also has is_active).
    let conditions = [];
    if (category) conditions.push(`category = '${category}'`);
    if (filter === 'active') conditions.push('is_active = 1');
    else if (filter === 'inactive') conditions.push('is_active = 0');
    const innerWhere = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = db.prepare(`
      SELECT si.*, u.display_name as created_by_display_name
      FROM (SELECT * FROM scope_items ${innerWhere}) si
      LEFT JOIN users u ON si.created_by = u.id
      ORDER BY si.created_at DESC
    `);
    return stmt.all();
  },

  getById: (id) => {
    const stmt = db.prepare('SELECT * FROM scope_items WHERE id = ?');
    return stmt.get(id);
  },

  create: (item) => {
    const stmt = db.prepare(`INSERT INTO scope_items (text, category, created_by) VALUES (?, ?, ?)`);
    const result = stmt.run(item.text, item.category, item.created_by || null);
    return result.lastInsertRowid;
  },

  update: (id, item) => {
    const stmt = db.prepare(`UPDATE scope_items SET text = ? WHERE id = ? AND is_active = 1`);
    stmt.run(item.text, id);
  },

  deactivate: (id) => {
    db.prepare(`UPDATE scope_items SET is_active = 0 WHERE id = ?`).run(id);
  },

  reactivate: (id) => {
    db.prepare(`UPDATE scope_items SET is_active = 1 WHERE id = ?`).run(id);
  },

  bulkCreate: (items, category, createdBy) => {
    const stmt = db.prepare(`INSERT INTO scope_items (text, category, created_by) VALUES (?, ?, ?)`);
    const insertMany = db.transaction((rows) => {
      for (const row of rows) {
        stmt.run(row.text, category, createdBy || null);
      }
    });
    insertMany(items);
  }
};

// Scope set operations
export const scopeSetOps = {
  getAll: (category, filter = 'active') => {
    let conditions = [];
    if (category) conditions.push(`ss.category = '${category}'`);
    if (filter === 'active') conditions.push('ss.is_active = 1');
    else if (filter === 'inactive') conditions.push('ss.is_active = 0');
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = db.prepare(`
      SELECT ss.*, u.display_name as created_by_display_name,
             COUNT(ssi.id) as item_count
      FROM scope_sets ss
      LEFT JOIN users u ON ss.created_by = u.id
      LEFT JOIN scope_set_items ssi ON ss.id = ssi.set_id
      ${where}
      GROUP BY ss.id
      ORDER BY ss.created_at DESC
    `);
    return stmt.all();
  },

  getById: (id) => {
    const set = db.prepare(`
      SELECT ss.*, u.display_name as created_by_display_name
      FROM scope_sets ss
      LEFT JOIN users u ON ss.created_by = u.id
      WHERE ss.id = ?
    `).get(id);
    if (!set) return null;
    const items = db.prepare(`
      SELECT si.*, ssi.order_index
      FROM scope_set_items ssi
      JOIN scope_items si ON ssi.item_id = si.id
      WHERE ssi.set_id = ?
      ORDER BY ssi.order_index ASC, ssi.id ASC
    `).all(id);
    return { ...set, items };
  },

  create: (scopeSet) => {
    const stmt = db.prepare(`INSERT INTO scope_sets (name, category, description, created_by) VALUES (?, ?, ?, ?)`);
    const result = stmt.run(scopeSet.name, scopeSet.category, scopeSet.description || null, scopeSet.created_by || null);
    return result.lastInsertRowid;
  },

  update: (id, scopeSet) => {
    db.prepare(`UPDATE scope_sets SET name = ?, description = ? WHERE id = ? AND is_locked = 0`).run(
      scopeSet.name, scopeSet.description || null, id
    );
  },

  lock: (id) => {
    db.prepare(`UPDATE scope_sets SET is_locked = 1 WHERE id = ?`).run(id);
  },

  lockMany: (ids) => {
    const stmt = db.prepare(`UPDATE scope_sets SET is_locked = 1 WHERE id = ?`);
    const lockAll = db.transaction((idList) => {
      for (const id of idList) stmt.run(id);
    });
    lockAll(ids);
  },

  deactivate: (id) => {
    db.prepare(`UPDATE scope_sets SET is_active = 0 WHERE id = ?`).run(id);
  },

  reactivate: (id) => {
    db.prepare(`UPDATE scope_sets SET is_active = 1 WHERE id = ?`).run(id);
  },

  addItem: (setId, itemId, orderIndex) => {
    // Check if already in set
    const existing = db.prepare(`SELECT id FROM scope_set_items WHERE set_id = ? AND item_id = ?`).get(setId, itemId);
    if (existing) return;
    const maxOrder = db.prepare(`SELECT COALESCE(MAX(order_index), -1) as max FROM scope_set_items WHERE set_id = ?`).get(setId);
    const order = orderIndex !== undefined ? orderIndex : maxOrder.max + 1;
    db.prepare(`INSERT INTO scope_set_items (set_id, item_id, order_index) VALUES (?, ?, ?)`).run(setId, itemId, order);
  },

  removeItem: (setId, itemId) => {
    db.prepare(`DELETE FROM scope_set_items WHERE set_id = ? AND item_id = ?`).run(setId, itemId);
  }
};

export default db;
