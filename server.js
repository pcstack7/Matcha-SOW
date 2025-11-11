import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import multer from "multer";
import fs from "fs";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import bcrypt from "bcryptjs";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign } from "docx";
import { accountOps, templateOps, sowOps, userOps, productOps, engagementTypeOps, uploadedSOWOps, dashboardOps } from "./database.js";
import passport from "./auth/passport-config.js";
import { isAuthenticated, isAdmin, requireAdmin } from "./auth/middleware.js";
import { initializeDefaultAdmin } from "./auth/init-admin.js";
import mammoth from "mammoth";

// Import CommonJS modules using createRequire
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

dotenv.config();

const app = express();

// Trust proxy - required when running behind Caddy/nginx reverse proxy
app.set('trust proxy', 1);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize session store
const SQLiteStore = connectSqlite3(session);

// Session configuration
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db", dir: __dirname }),
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: 'lax', // Required for cross-site cookie handling
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Initialize default admin user
await initializeDefaultAdmin();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/templates");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".pdf", ".docx", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, DOCX, and TXT are allowed."));
    }
  },
});

// Configure multer for SOW Knowledge Bank uploads
const sowStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/sow-bank");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const sowUpload = multer({
  storage: sowStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".pdf", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF and DOCX are allowed for SOW uploads."));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads', 'templates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✓ Created directory: uploads/templates');
}

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.MATCHA_API_KEY;
const WORKSPACE_ID = process.env.WORKSPACE_ID || 2010;
const BASE_URL = process.env.BASE_URL || "https://matcha.harriscomputer.com/rest/api/v1";
const MISSION_ID = process.env.MISSION_ID || 7618;
const FOLDER_ID = process.env.FOLDER_ID || 10917; // Matcha folder for SOW uploads

if (!API_KEY) {
  console.error("❌ MATCHA_API_KEY is missing in .env file.");
  process.exit(1);
}

// Ensure upload directory for SOW Knowledge Bank files exists
const sowUploadDir = path.join(__dirname, 'uploads', 'sow-bank');
if (!fs.existsSync(sowUploadDir)) {
  fs.mkdirSync(sowUploadDir, { recursive: true });
  console.log('✓ Created directory: uploads/sow-bank');
}

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

// Register new user
app.post("/auth/register", async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }

    // Check if username already exists
    if (userOps.getByUsername(username)) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Check if email already exists
    if (userOps.getByEmail(email)) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const id = userOps.create({
      username,
      email,
      password_hash,
      role: "user", // New users are regular users by default
      auth_provider: "local",
      display_name: displayName || username,
      is_active: 1,
    });

    const user = userOps.getById(id);
    res.status(201).json({ message: "User registered successfully", user });
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// Login
app.post("/auth/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: "Authentication error" });
    }
    if (!user) {
      return res.status(401).json({ error: info.message || "Invalid credentials" });
    }

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: "Login error" });
      }
      return res.json({ message: "Login successful", user });
    });
  })(req, res, next);
});

// Logout
app.post("/auth/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout error" });
    }
    res.json({ message: "Logout successful" });
  });
});

// Get current session/user
app.get("/auth/session", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ authenticated: true, user: req.user });
  } else {
    res.json({ authenticated: false, user: null });
  }
});

// ============================================
// USER MANAGEMENT ENDPOINTS (Admin Only)
// ============================================

// Get all users
app.get("/api/users", requireAdmin, (req, res) => {
  try {
    const users = userOps.getAll();
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get user by ID
app.get("/api/users/:id", requireAdmin, (req, res) => {
  try {
    const user = userOps.getById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Create new user
app.post("/api/users", requireAdmin, async (req, res) => {
  try {
    const { username, email, password, role, displayName, is_active } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: "Username and email are required" });
    }

    // Check if username already exists
    if (userOps.getByUsername(username)) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Check if email already exists
    if (userOps.getByEmail(email)) {
      return res.status(400).json({ error: "Email already exists" });
    }

    let password_hash = null;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    const id = userOps.create({
      username,
      email,
      password_hash,
      role: role || "user",
      auth_provider: "local",
      display_name: displayName || username,
      is_active: is_active !== undefined ? is_active : 1,
    });

    const user = userOps.getById(id);
    res.status(201).json(user);
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Update user
app.put("/api/users/:id", requireAdmin, (req, res) => {
  try {
    const { username, email, role, display_name, is_active } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: "Username and email are required" });
    }

    const existingUser = userOps.getById(req.params.id);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if trying to deactivate the last admin
    if (existingUser.role === "admin" && (role !== "admin" || is_active === 0)) {
      const adminCount = userOps.countAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Cannot modify the last active admin" });
      }
    }

    userOps.update(req.params.id, {
      username,
      email,
      role,
      display_name,
      is_active,
    });

    const user = userOps.getById(req.params.id);
    res.json(user);
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Change user password
app.put("/api/users/:id/password", requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const user = userOps.getById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const password_hash = await bcrypt.hash(password, 10);
    userOps.updatePassword(req.params.id, password_hash);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Error updating password:", err);
    res.status(500).json({ error: "Failed to update password" });
  }
});

// Delete user
app.delete("/api/users/:id", requireAdmin, (req, res) => {
  try {
    const user = userOps.getById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent deleting the last admin
    if (user.role === "admin") {
      const adminCount = userOps.countAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Cannot delete the last active admin" });
      }
    }

    userOps.delete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ============================================
// PRODUCT MANAGEMENT ENDPOINTS
// ============================================

// Get all products
app.get("/api/products", isAuthenticated, (req, res) => {
  try {
    const filter = req.query.filter || 'active'; // 'active', 'inactive', or 'all'
    const products = productOps.getAll(filter);
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Get product by ID
app.get("/api/products/:id", isAuthenticated, (req, res) => {
  try {
    const product = productOps.getById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Create new product (Admin only)
app.post("/api/products", requireAdmin, (req, res) => {
  try {
    const { name, portfolio, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Product name is required" });
    }
    const id = productOps.create({ name, portfolio, description });
    const product = productOps.getById(id);
    res.status(201).json(product);
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// Update product (Admin only)
app.put("/api/products/:id", requireAdmin, (req, res) => {
  try {
    const { name, portfolio, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Product name is required" });
    }
    productOps.update(req.params.id, { name, portfolio, description });
    const product = productOps.getById(req.params.id);
    res.json(product);
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// Deactivate product (Admin only)
app.patch("/api/products/:id/deactivate", requireAdmin, (req, res) => {
  try {
    productOps.deactivate(req.params.id);
    const product = productOps.getById(req.params.id);
    res.json({ message: "Product deactivated successfully", product });
  } catch (err) {
    console.error("Error deactivating product:", err);
    res.status(500).json({ error: "Failed to deactivate product" });
  }
});

// Reactivate product (Admin only)
app.patch("/api/products/:id/reactivate", requireAdmin, (req, res) => {
  try {
    productOps.reactivate(req.params.id);
    const product = productOps.getById(req.params.id);
    res.json({ message: "Product reactivated successfully", product });
  } catch (err) {
    console.error("Error reactivating product:", err);
    res.status(500).json({ error: "Failed to reactivate product" });
  }
});

// ============================================
// ENGAGEMENT TYPE MANAGEMENT ENDPOINTS
// ============================================

// Get all engagement types
app.get("/api/engagement-types", isAuthenticated, (req, res) => {
  try {
    const filter = req.query.filter || 'active'; // 'active', 'inactive', or 'all'
    const engagementTypes = engagementTypeOps.getAll(filter);
    res.json(engagementTypes);
  } catch (err) {
    console.error("Error fetching engagement types:", err);
    res.status(500).json({ error: "Failed to fetch engagement types" });
  }
});

// Get engagement type by ID
app.get("/api/engagement-types/:id", isAuthenticated, (req, res) => {
  try {
    const engagementType = engagementTypeOps.getById(req.params.id);
    if (!engagementType) {
      return res.status(404).json({ error: "Engagement type not found" });
    }
    res.json(engagementType);
  } catch (err) {
    console.error("Error fetching engagement type:", err);
    res.status(500).json({ error: "Failed to fetch engagement type" });
  }
});

// Create new engagement type (Admin only)
app.post("/api/engagement-types", requireAdmin, (req, res) => {
  try {
    const { name, category, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Engagement type name is required" });
    }
    const id = engagementTypeOps.create({ name, category, description });
    const engagementType = engagementTypeOps.getById(id);
    res.status(201).json(engagementType);
  } catch (err) {
    console.error("Error creating engagement type:", err);
    res.status(500).json({ error: "Failed to create engagement type" });
  }
});

// Update engagement type (Admin only)
app.put("/api/engagement-types/:id", requireAdmin, (req, res) => {
  try {
    const { name, category, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Engagement type name is required" });
    }
    engagementTypeOps.update(req.params.id, { name, category, description });
    const engagementType = engagementTypeOps.getById(req.params.id);
    res.json(engagementType);
  } catch (err) {
    console.error("Error updating engagement type:", err);
    res.status(500).json({ error: "Failed to update engagement type" });
  }
});

// Deactivate engagement type (Admin only)
app.patch("/api/engagement-types/:id/deactivate", requireAdmin, (req, res) => {
  try {
    engagementTypeOps.deactivate(req.params.id);
    const engagementType = engagementTypeOps.getById(req.params.id);
    res.json({ message: "Engagement type deactivated successfully", engagementType });
  } catch (err) {
    console.error("Error deactivating engagement type:", err);
    res.status(500).json({ error: "Failed to deactivate engagement type" });
  }
});

// Reactivate engagement type (Admin only)
app.patch("/api/engagement-types/:id/reactivate", requireAdmin, (req, res) => {
  try {
    engagementTypeOps.reactivate(req.params.id);
    const engagementType = engagementTypeOps.getById(req.params.id);
    res.json({ message: "Engagement type reactivated successfully", engagementType });
  } catch (err) {
    console.error("Error reactivating engagement type:", err);
    res.status(500).json({ error: "Failed to reactivate engagement type" });
  }
});

// ============================================
// SOW KNOWLEDGE BANK ENDPOINTS
// ============================================

// Get all uploaded SOWs
app.get("/api/uploaded-sows", isAuthenticated, (req, res) => {
  try {
    const filter = req.query.filter || 'active'; // Default to active
    const uploadedSOWs = uploadedSOWOps.getAll(filter);
    res.json(uploadedSOWs);
  } catch (err) {
    console.error("Error fetching uploaded SOWs:", err);
    res.status(500).json({ error: "Failed to fetch uploaded SOWs" });
  }
});

// Get uploaded SOW by ID
app.get("/api/uploaded-sows/:id", isAuthenticated, (req, res) => {
  try {
    const uploadedSOW = uploadedSOWOps.getById(req.params.id);
    if (!uploadedSOW) {
      return res.status(404).json({ error: "Uploaded SOW not found" });
    }
    res.json(uploadedSOW);
  } catch (err) {
    console.error("Error fetching uploaded SOW:", err);
    res.status(500).json({ error: "Failed to fetch uploaded SOW" });
  }
});

// Upload SOW to Knowledge Bank and Matcha
app.post("/api/uploaded-sows", isAuthenticated, sowUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const {
      account_id,
      product_id,
      engagement_type_id,
      description,
      pricing,
      currency,
      pm_hours,
      ic_hours,
      sa_hours,
      se_hours,
      trainer_hours,
      integration_hours,
      apac_testing_hours,
      apac_rd_hours
    } = req.body;

    if (!account_id) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Account is required" });
    }

    // Upload file to Matcha
    let matchaFileId = null;
    try {
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('file', fs.createReadStream(req.file.path));

      const matchaResponse = await fetch(`${BASE_URL}/file?folder_id=${FOLDER_ID}`, {
        method: 'POST',
        headers: {
          'MATCHA-API-KEY': API_KEY,
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (matchaResponse.ok) {
        const matchaData = await matchaResponse.json();
        matchaFileId = matchaData.id || matchaData.file_id;
        console.log(`✓ File uploaded to Matcha with ID: ${matchaFileId}`);
      } else {
        console.warn(`⚠ Failed to upload to Matcha: ${matchaResponse.statusText}`);
      }
    } catch (matchaErr) {
      console.error("Error uploading to Matcha:", matchaErr);
      // Continue even if Matcha upload fails
    }

    // Save to database
    const id = uploadedSOWOps.create({
      account_id: parseInt(account_id),
      product_id: product_id ? parseInt(product_id) : null,
      engagement_type_id: engagement_type_id ? parseInt(engagement_type_id) : null,
      description: description || null,
      file_name: req.file.originalname,
      file_path: req.file.path,
      matcha_file_id: matchaFileId,
      pricing: pricing ? parseFloat(pricing) : null,
      currency: currency || 'USD',
      pm_hours: pm_hours ? parseFloat(pm_hours) : null,
      ic_hours: ic_hours ? parseFloat(ic_hours) : null,
      sa_hours: sa_hours ? parseFloat(sa_hours) : null,
      se_hours: se_hours ? parseFloat(se_hours) : null,
      trainer_hours: trainer_hours ? parseFloat(trainer_hours) : null,
      integration_hours: integration_hours ? parseFloat(integration_hours) : null,
      apac_testing_hours: apac_testing_hours ? parseFloat(apac_testing_hours) : null,
      apac_rd_hours: apac_rd_hours ? parseFloat(apac_rd_hours) : null,
      created_by: req.user.id,
    });

    res.json({
      message: "SOW uploaded successfully",
      id,
      matcha_file_id: matchaFileId,
    });
  } catch (err) {
    console.error("Error uploading SOW:", err);
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "Failed to upload SOW" });
  }
});

// Update uploaded SOW metadata (not the file)
app.put("/api/uploaded-sows/:id", isAuthenticated, (req, res) => {
  try {
    const {
      account_id,
      product_id,
      engagement_type_id,
      description,
      pricing,
      currency,
      pm_hours,
      ic_hours,
      sa_hours,
      se_hours,
      trainer_hours,
      integration_hours,
      apac_testing_hours,
      apac_rd_hours
    } = req.body;

    uploadedSOWOps.update(req.params.id, {
      account_id: parseInt(account_id),
      product_id: product_id ? parseInt(product_id) : null,
      engagement_type_id: engagement_type_id ? parseInt(engagement_type_id) : null,
      description: description || null,
      pricing: pricing ? parseFloat(pricing) : null,
      currency: currency || 'USD',
      pm_hours: pm_hours ? parseFloat(pm_hours) : null,
      ic_hours: ic_hours ? parseFloat(ic_hours) : null,
      sa_hours: sa_hours ? parseFloat(sa_hours) : null,
      se_hours: se_hours ? parseFloat(se_hours) : null,
      trainer_hours: trainer_hours ? parseFloat(trainer_hours) : null,
      integration_hours: integration_hours ? parseFloat(integration_hours) : null,
      apac_testing_hours: apac_testing_hours ? parseFloat(apac_testing_hours) : null,
      apac_rd_hours: apac_rd_hours ? parseFloat(apac_rd_hours) : null,
      updated_by: req.user.id,
    });

    res.json({ message: "Uploaded SOW updated successfully" });
  } catch (err) {
    console.error("Error updating uploaded SOW:", err);
    res.status(500).json({ error: "Failed to update uploaded SOW" });
  }
});

// Deactivate uploaded SOW (soft delete)
app.put("/api/uploaded-sows/:id/deactivate", isAuthenticated, (req, res) => {
  try {
    uploadedSOWOps.deactivate(req.params.id, req.user.id);
    res.json({ message: "Uploaded SOW deactivated successfully" });
  } catch (err) {
    console.error("Error deactivating uploaded SOW:", err);
    res.status(500).json({ error: "Failed to deactivate uploaded SOW" });
  }
});

// Reactivate uploaded SOW
app.put("/api/uploaded-sows/:id/reactivate", isAuthenticated, (req, res) => {
  try {
    uploadedSOWOps.reactivate(req.params.id, req.user.id);
    res.json({ message: "Uploaded SOW reactivated successfully" });
  } catch (err) {
    console.error("Error reactivating uploaded SOW:", err);
    res.status(500).json({ error: "Failed to reactivate uploaded SOW" });
  }
});

// ============================================
// ACCOUNT MANAGEMENT ENDPOINTS
// ============================================

// Get all accounts
app.get("/api/accounts", isAuthenticated, (req, res) => {
  try {
    const filter = req.query.filter || 'active'; // 'active', 'inactive', or 'all'
    const accounts = accountOps.getAll(filter);
    res.json(accounts);
  } catch (err) {
    console.error("Error fetching accounts:", err);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

// Get account by ID
app.get("/api/accounts/:id", isAuthenticated, (req, res) => {
  try {
    const account = accountOps.getById(req.params.id);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json(account);
  } catch (err) {
    console.error("Error fetching account:", err);
    res.status(500).json({ error: "Failed to fetch account" });
  }
});

// Create new account (Admin only)
app.post("/api/accounts", requireAdmin, (req, res) => {
  try {
    const { name, account_contact, email, phone, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Account name is required" });
    }
    const id = accountOps.create({ name, account_contact, email, phone, notes });
    const account = accountOps.getById(id);
    res.status(201).json(account);
  } catch (err) {
    console.error("Error creating account:", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// Update account (Admin only)
app.put("/api/accounts/:id", requireAdmin, (req, res) => {
  try {
    const { name, account_contact, email, phone, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Account name is required" });
    }
    accountOps.update(req.params.id, { name, account_contact, email, phone, notes });
    const account = accountOps.getById(req.params.id);
    res.json(account);
  } catch (err) {
    console.error("Error updating account:", err);
    res.status(500).json({ error: "Failed to update account" });
  }
});

// Deactivate account (Admin only)
app.patch("/api/accounts/:id/deactivate", requireAdmin, (req, res) => {
  try {
    accountOps.deactivate(req.params.id);
    const account = accountOps.getById(req.params.id);
    res.json({ message: "Account deactivated successfully", account });
  } catch (err) {
    console.error("Error deactivating account:", err);
    res.status(500).json({ error: "Failed to deactivate account" });
  }
});

// Reactivate account (Admin only)
app.patch("/api/accounts/:id/reactivate", requireAdmin, (req, res) => {
  try {
    accountOps.reactivate(req.params.id);
    const account = accountOps.getById(req.params.id);
    res.json({ message: "Account reactivated successfully", account });
  } catch (err) {
    console.error("Error reactivating account:", err);
    res.status(500).json({ error: "Failed to reactivate account" });
  }
});

// ============================================
// TEMPLATE MANAGEMENT ENDPOINTS
// ============================================

// Get all templates
app.get("/api/templates", isAuthenticated, (req, res) => {
  try {
    const templates = templateOps.getAll();
    res.json(templates);
  } catch (err) {
    console.error("Error fetching templates:", err);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Upload template
app.post("/api/templates", isAuthenticated, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { name } = req.body;
    const fileName = name || req.file.originalname;
    const fileType = path.extname(req.file.originalname).toLowerCase();

    // Read file content for text files
    let content = null;
    if (fileType === ".txt") {
      content = fs.readFileSync(req.file.path, "utf8");
    }

    const id = templateOps.create({
      name: fileName,
      file_path: req.file.path,
      file_type: fileType,
      content: content,
    });

    const template = templateOps.getById(id);
    res.status(201).json(template);
  } catch (err) {
    console.error("Error uploading template:", err);
    res.status(500).json({ error: "Failed to upload template" });
  }
});

// Delete template
app.delete("/api/templates/:id", isAuthenticated, (req, res) => {
  try {
    const template = templateOps.getById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Delete the file from filesystem
    if (fs.existsSync(template.file_path)) {
      fs.unlinkSync(template.file_path);
    }

    templateOps.delete(req.params.id);
    res.json({ message: "Template deleted successfully" });
  } catch (err) {
    console.error("Error deleting template:", err);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// Get template content
app.get("/api/templates/:id/content", isAuthenticated, async (req, res) => {
  try {
    const template = templateOps.getById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Check if file exists
    if (!fs.existsSync(template.file_path)) {
      return res.status(404).json({ error: "Template file not found" });
    }

    let content = "";
    let contentType = "text"; // 'text', 'html'

    // Handle different file types
    switch (template.file_type) {
      case ".txt":
        // For TXT files, use the content from database or read the file
        content = template.content || fs.readFileSync(template.file_path, "utf8");
        contentType = "text";
        break;

      case ".pdf":
        // Extract text from PDF with structure preservation
        try {
          const dataBuffer = fs.readFileSync(template.file_path);
          const pdfData = await pdfParse(dataBuffer);
          content = pdfData.text;
          contentType = "text";
        } catch (pdfErr) {
          console.error("Error parsing PDF:", pdfErr);
          return res.status(500).json({ error: "Failed to extract PDF content" });
        }
        break;

      case ".docx":
        // Extract HTML from DOCX to preserve formatting
        try {
          const result = await mammoth.convertToHtml({ path: template.file_path });
          content = result.value;
          contentType = "html";
        } catch (docxErr) {
          console.error("Error parsing DOCX:", docxErr);
          return res.status(500).json({ error: "Failed to extract DOCX content" });
        }
        break;

      default:
        return res.status(400).json({ error: "Unsupported file type" });
    }

    res.json({
      id: template.id,
      name: template.name,
      file_type: template.file_type,
      content: content,
      content_type: contentType
    });
  } catch (err) {
    console.error("Error fetching template content:", err);
    res.status(500).json({ error: "Failed to fetch template content" });
  }
});

// ============================================
// SOW MANAGEMENT ENDPOINTS
// ============================================

// Get all SOWs
app.get("/api/sows", isAuthenticated, (req, res) => {
  try {
    const sows = sowOps.getAll();
    res.json(sows);
  } catch (err) {
    console.error("Error fetching SOWs:", err);
    res.status(500).json({ error: "Failed to fetch SOWs" });
  }
});

// Get SOW by ID
app.get("/api/sows/:id", isAuthenticated, (req, res) => {
  try {
    const sow = sowOps.getById(req.params.id);
    if (!sow) {
      return res.status(404).json({ error: "SOW not found" });
    }
    res.json(sow);
  } catch (err) {
    console.error("Error fetching SOW:", err);
    res.status(500).json({ error: "Failed to fetch SOW" });
  }
});

// Get SOWs by account ID
app.get("/api/sows/account/:accountId", isAuthenticated, (req, res) => {
  try {
    const sows = sowOps.getByAccountId(req.params.accountId);
    res.json(sows);
  } catch (err) {
    console.error("Error fetching SOWs:", err);
    res.status(500).json({ error: "Failed to fetch SOWs" });
  }
});

// Generate SOW using AI
app.post("/api/sows/generate", isAuthenticated, async (req, res) => {
  try {
    const { account_id, template_id, product_id, engagement_type_id, project_notes, deliverables } = req.body;

    if (!account_id || !project_notes || !deliverables) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get account details
    const account = accountOps.getById(account_id);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    // Get template if provided (for content reference and name)
    let templateContent = "";
    let templateName = "";
    if (template_id) {
      const template = templateOps.getById(template_id);
      if (template) {
        templateName = template.name;
        if (template.content) {
          templateContent = `\n\nUse this template as a reference:\n${template.content}`;
        }
      }
    }

    // Build the AI prompt
    const prompt = `Generate a professional Statement of Work (SOW) document with the following details:

Account: ${account.name}${account.account_contact ? ` (Contact: ${account.account_contact})` : ""}
Email: ${account.email || "N/A"}
Phone: ${account.phone || "N/A"}
Notes: ${account.notes || "N/A"}${templateName ? `\nTemplate: ${templateName}` : ""}

Project Notes:
${project_notes}

Deliverables:
${deliverables}${templateContent}

Please generate a complete, professional SOW document with appropriate sections including:
- Executive Summary
- Project Scope
- Deliverables
- Timeline
- Terms and Conditions
- Acceptance Criteria

Format the output as a well-structured document with clear section headers and subheaders.`;

    // Call Matcha API
    const response = await fetch(`${BASE_URL}/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MATCHA-API-KEY": API_KEY,
      },
      body: JSON.stringify({
        mission_id: MISSION_ID,
        input: prompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API error:", errorText);
      return res.status(response.status).json({ error: "Matcha API failed" });
    }

    const data = await response.json();
    const content = data?.output?.[0]?.content?.[0]?.text || "No response generated.";

    // Save SOW to database with user tracking
    const id = sowOps.create({
      account_id,
      template_id: template_id || null,
      product_id: product_id || null,
      engagement_type_id: engagement_type_id || null,
      project_notes,
      deliverables,
      content,
      created_by: req.user.id, // Current authenticated user
    });

    const sow = sowOps.getById(id);
    res.status(201).json(sow);
  } catch (err) {
    console.error("Error generating SOW:", err);
    res.status(500).json({ error: "Failed to generate SOW" });
  }
});

// Delete SOW
app.delete("/api/sows/:id", isAuthenticated, (req, res) => {
  try {
    sowOps.delete(req.params.id);
    res.json({ message: "SOW deleted successfully" });
  } catch (err) {
    console.error("Error deleting SOW:", err);
    res.status(500).json({ error: "Failed to delete SOW" });
  }
});

// ============================================
// EXPORT ENDPOINTS
// ============================================

// Helper function to parse markdown tables
function parseTable(lines, startIndex) {
  const tableLines = [];
  let i = startIndex;

  while (i < lines.length && lines[i].trim().startsWith('|')) {
    tableLines.push(lines[i]);
    i++;
  }

  if (tableLines.length < 2) return null;

  const headerCells = tableLines[0]
    .split('|')
    .map(cell => cell.trim())
    .filter(cell => cell !== '');

  const dataRows = [];
  for (let j = 2; j < tableLines.length; j++) {
    const cells = tableLines[j]
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell !== '');
    if (cells.length > 0) {
      dataRows.push(cells);
    }
  }

  return {
    headers: headerCells,
    rows: dataRows,
    endIndex: i
  };
}

// Helper function to render table in PDF
function renderPDFTable(doc, table) {
  const startX = doc.page.margins.left;
  const startY = doc.y;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = pageWidth / table.headers.length;
  const rowHeight = 20;

  // Helper to render text with bold markdown
  const renderCellWithBold = (text, x, y, width, color) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;
    let currentX = x + 5;

    while ((match = boldRegex.exec(text)) !== null) {
      // Render text before bold
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index);
        doc.font('Helvetica').fontSize(9.5).fillColor(color).text(beforeText, currentX, y + 5, {
          width: width - 10,
          height: rowHeight - 10,
          align: 'left',
          continued: true
        });
      }
      // Render bold text
      doc.font('Helvetica-Bold').text(match[1], { continued: true });
      lastIndex = match.index + match[0].length;
    }

    // Render remaining text
    if (lastIndex < text.length) {
      doc.font('Helvetica').text(text.substring(lastIndex));
    } else if (lastIndex > 0) {
      doc.text(''); // Complete the line
    } else {
      doc.font('Helvetica').fontSize(9.5).fillColor(color).text(text, x + 5, y + 5, {
        width: width - 10,
        height: rowHeight - 10,
        align: 'left'
      });
    }
  };

  // Draw headers
  table.headers.forEach((header, i) => {
    const x = startX + (i * columnWidth);
    doc.rect(x, startY, columnWidth, rowHeight).fillAndStroke("#707CF1", "#ddd");
    renderCellWithBold(header, x, startY, columnWidth, "#FFFFFF");
  });

  // Draw rows
  let currentY = startY + rowHeight;

  table.rows.forEach((row, rowIdx) => {
    row.forEach((cell, cellIdx) => {
      const x = startX + (cellIdx * columnWidth);
      doc.rect(x, currentY, columnWidth, rowHeight).stroke("#ddd");
      renderCellWithBold(cell, x, currentY, columnWidth, "#000000");
    });
    currentY += rowHeight;
  });

  doc.y = currentY + 10;
}

// Export SOW to PDF
app.get("/api/export/:id/pdf", isAuthenticated, (req, res) => {
  try {
    const sow = sowOps.getById(req.params.id);
    if (!sow) {
      return res.status(404).json({ error: "SOW not found" });
    }

    const doc = new PDFDocument({ margin: 50 });
    const filename = `SOW-${sow.account_name.replace(/\s+/g, "-")}-${Date.now()}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Main Header
    doc.font('Helvetica-Bold').fontSize(24).fillColor("#151744").text("Statement of Work", { align: "center" });
    doc.moveDown();

    // Client Info Header
    doc.font('Helvetica-Bold').fontSize(16).fillColor("#707CF1").text("Client Information", { underline: true });
    doc.moveDown(0.5);

    // Client details
    doc.font('Helvetica').fontSize(9.5).fillColor("#000000");
    doc.text(`Account: ${sow.account_name}`);
    if (sow.account_contact) doc.text(`Contact: ${sow.account_contact}`);
    doc.text(`Date: ${new Date(sow.created_at).toLocaleDateString()}`);
    doc.moveDown();

    // Parse and format content with tables, bullets, and inline markdown
    const lines = sow.content.split('\n');
    let i = 0;

    // Helper function to render text with inline bold markdown
    const renderTextWithBold = (text, doc, options = {}) => {
      const boldRegex = /\*\*(.*?)\*\*/g;
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(text)) !== null) {
        // Render text before bold
        if (match.index > lastIndex) {
          doc.font('Helvetica').text(text.substring(lastIndex, match.index), { ...options, continued: true });
        }
        // Render bold text
        doc.font('Helvetica-Bold').text(match[1], { ...options, continued: true });
        lastIndex = match.index + match[0].length;
      }

      // Render remaining text
      if (lastIndex < text.length) {
        doc.font('Helvetica').text(text.substring(lastIndex), options);
      } else if (lastIndex > 0) {
        doc.text('', options); // Complete the line
      } else {
        doc.font('Helvetica').text(text, options);
      }
    };

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim() === '') {
        doc.moveDown(0.5);
        i++;
        continue;
      }

      // Check for table
      if (line.trim().startsWith('|')) {
        const table = parseTable(lines, i);
        if (table) {
          renderPDFTable(doc, table);
          i = table.endIndex;
          continue;
        }
      }

      // Check if line is a main header
      if (line.match(/^#{1,2}\s+/) || line.match(/^[A-Z\s]{3,}:?\s*$/)) {
        const headerText = line.replace(/^#{1,2}\s+/, '').trim();
        doc.font('Helvetica-Bold').fontSize(16).fillColor("#707CF1").text(headerText);
        doc.moveDown(0.5);
      }
      // Check if line is a subheader
      else if (line.match(/^#{3,4}\s+/) || line.match(/^\*\*.*\*\*$/)) {
        const subHeaderText = line.replace(/^#{3,4}\s+/, '').replace(/\*\*/g, '').trim();
        doc.font('Helvetica-Bold').fontSize(14).fillColor("#383392").text(subHeaderText);
        doc.moveDown(0.3);
      }
      // Check if line is a bullet point but NOT if content is all bold
      else if (line.match(/^\s*[-*•]\s+/)) {
        const bulletContent = line.replace(/^\s*[-*•]\s+/, '').trim();

        // If the content after the bullet is entirely bold, treat as subheader
        if (bulletContent.match(/^\*\*.*\*\*$/)) {
          const subHeaderText = bulletContent.replace(/\*\*/g, '').trim();
          doc.font('Helvetica-Bold').fontSize(14).fillColor("#383392").text(subHeaderText);
          doc.moveDown(0.3);
        } else {
          // Regular bullet point
          const currentY = doc.y;
          doc.font('Helvetica').fontSize(9.5).fillColor("#5E63CD").text('•', 60, currentY, { continued: false });
          doc.font('Helvetica').fontSize(9.5).fillColor("#000000");
          renderTextWithBold(bulletContent, doc, { indent: 30, lineGap: 2 });
        }
      }
      // Regular content
      else {
        doc.fontSize(9.5).fillColor("#000000");
        renderTextWithBold(line, doc, { align: 'left' });
      }

      i++;
    }

    doc.end();
  } catch (err) {
    console.error("Error exporting to PDF:", err);
    res.status(500).json({ error: "Failed to export to PDF" });
  }
});

// Export SOW to DOCX
app.get("/api/export/:id/docx", isAuthenticated, async (req, res) => {
  try {
    const sow = sowOps.getById(req.params.id);
    if (!sow) {
      return res.status(404).json({ error: "SOW not found" });
    }

    const filename = `SOW-${sow.account_name.replace(/\s+/g, "-")}-${Date.now()}.docx`;

    // Helper function to parse inline markdown (bold) for DOCX
    const parseInlineMarkdownForDocx = (text) => {
      const textRuns = [];
      const boldRegex = /\*\*(.*?)\*\*/g;
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
          textRuns.push(
            new TextRun({
              text: text.substring(lastIndex, match.index),
              font: "Verdana",
              size: 19,
            })
          );
        }
        // Add bold text
        textRuns.push(
          new TextRun({
            text: match[1],
            bold: true,
            font: "Verdana",
            size: 19,
          })
        );
        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        textRuns.push(
          new TextRun({
            text: text.substring(lastIndex),
            font: "Verdana",
            size: 19,
          })
        );
      }

      return textRuns.length > 0 ? textRuns : [new TextRun({ text, font: "Verdana", size: 19 })];
    };

    // Parse content and create formatted paragraphs/tables
    const contentElements = [];
    const lines = sow.content.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim() === '') {
        contentElements.push(new Paragraph({ text: "" }));
        i++;
        continue;
      }

      // Check for table
      if (line.trim().startsWith('|')) {
        const table = parseTable(lines, i);
        if (table) {
          // Create table header row
          const headerRow = new TableRow({
            children: table.headers.map(header =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: parseInlineMarkdownForDocx(header).map(run => {
                      run.bold = true;
                      run.color = "FFFFFF";
                      return run;
                    }),
                  }),
                ],
                shading: {
                  fill: "707CF1",
                },
                verticalAlign: VerticalAlign.CENTER,
              })
            ),
          });

          // Create table data rows
          const dataRows = table.rows.map(row =>
            new TableRow({
              children: row.map(cell =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: parseInlineMarkdownForDocx(cell),
                    }),
                  ],
                  verticalAlign: VerticalAlign.CENTER,
                })
              ),
            })
          );

          // Create complete table
          contentElements.push(
            new Table({
              rows: [headerRow, ...dataRows],
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
              },
            })
          );

          i = table.endIndex;
          continue;
        }
      }

      // Check if line is a main header
      if (line.match(/^#{1,2}\s+/) || line.match(/^[A-Z\s]{3,}:?\s*$/)) {
        const headerText = line.replace(/^#{1,2}\s+/, '').trim();
        contentElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: headerText,
                bold: true,
                font: "Verdana",
                size: 32, // 16pt = 32 half-points
                color: "707CF1",
              }),
            ],
            spacing: { before: 200, after: 100 },
          })
        );
      }
      // Check if line is a subheader
      else if (line.match(/^#{3,4}\s+/) || line.match(/^\*\*.*\*\*$/)) {
        const subHeaderText = line.replace(/^#{3,4}\s+/, '').replace(/\*\*/g, '').trim();
        contentElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: subHeaderText,
                bold: true,
                font: "Verdana",
                size: 28, // 14pt = 28 half-points
                color: "383392",
              }),
            ],
            spacing: { before: 150, after: 75 },
          })
        );
      }
      // Check if line is a bullet point
      else if (line.match(/^\s*[-*•]\s+/)) {
        const bulletContent = line.replace(/^\s*[-*•]\s+/, '').trim();

        // If content after bullet is entirely bold, treat as subheader
        if (bulletContent.match(/^\*\*.*\*\*$/)) {
          const subHeaderText = bulletContent.replace(/\*\*/g, '').trim();
          contentElements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: subHeaderText,
                  bold: true,
                  font: "Verdana",
                  size: 28, // 14pt = 28 half-points
                  color: "383392",
                }),
              ],
              spacing: { before: 150, after: 75 },
            })
          );
        } else {
          // Regular bullet with better spacing
          contentElements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: '•  ', // Added extra space
                  font: "Verdana",
                  size: 19, // 9.5pt = 19 half-points
                  color: "5E63CD",
                }),
                ...parseInlineMarkdownForDocx(bulletContent),
              ],
              indent: { left: 360 }, // Indent bullets
            })
          );
        }
      }
      // Regular content
      else {
        contentElements.push(
          new Paragraph({
            children: parseInlineMarkdownForDocx(line),
          })
        );
      }

      i++;
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Statement of Work",
                  bold: true,
                  font: "Verdana",
                  size: 48, // 24pt
                  color: "151744",
                }),
              ],
              alignment: "center",
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Client Information",
                  bold: true,
                  font: "Verdana",
                  size: 32, // 16pt
                  color: "707CF1",
                  underline: {},
                }),
              ],
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Account: ", bold: true, font: "Verdana", size: 19 }),
                new TextRun({ text: sow.account_name, font: "Verdana", size: 19 }),
              ],
            }),
            ...(sow.account_contact
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Contact: ", bold: true, font: "Verdana", size: 19 }),
                      new TextRun({ text: sow.account_contact, font: "Verdana", size: 19 }),
                    ],
                  }),
                ]
              : []),
            new Paragraph({
              children: [
                new TextRun({ text: "Date: ", bold: true, font: "Verdana", size: 19 }),
                new TextRun({ text: new Date(sow.created_at).toLocaleDateString(), font: "Verdana", size: 19 }),
              ],
              spacing: { after: 300 },
            }),
            ...contentElements,
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error("Error exporting to DOCX:", err);
    res.status(500).json({ error: "Failed to export to DOCX" });
  }
});

// Export SOW to TXT
app.get("/api/export/:id/txt", isAuthenticated, (req, res) => {
  try {
    const sow = sowOps.getById(req.params.id);
    if (!sow) {
      return res.status(404).json({ error: "SOW not found" });
    }

    const filename = `SOW-${sow.account_name.replace(/\s+/g, "-")}-${Date.now()}.txt`;

    let content = `STATEMENT OF WORK\n`;
    content += `${"=".repeat(50)}\n\n`;
    content += `CLIENT INFORMATION\n`;
    content += `Account: ${sow.account_name}\n`;
    if (sow.account_company) content += `Company: ${sow.account_company}\n`;
    content += `Date: ${new Date(sow.created_at).toLocaleDateString()}\n\n`;
    content += `${"=".repeat(50)}\n\n`;
    content += sow.content;

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (err) {
    console.error("Error exporting to TXT:", err);
    res.status(500).json({ error: "Failed to export to TXT" });
  }
});

// ============================================
// DASHBOARD ANALYTICS ENDPOINT
// ============================================

// Get dashboard analytics data
app.get("/api/dashboard", isAuthenticated, (req, res) => {
  try {
    const counts = dashboardOps.getCounts();
    const pricingSummary = dashboardOps.getPricingSummary();
    const pricingByAccount = dashboardOps.getPricingByAccount();
    const pricingByProduct = dashboardOps.getPricingByProduct();
    const pricingByUser = dashboardOps.getPricingByUser();
    const resourceHours = dashboardOps.getResourceHoursBreakdown();
    const topAccounts = dashboardOps.getTopAccountsBySowCount(10);
    const timeline = dashboardOps.getSowTimeline();
    const engagementTypes = dashboardOps.getEngagementTypeDistribution();

    res.json({
      counts,
      pricingSummary,
      pricingByAccount,
      pricingByProduct,
      pricingByUser,
      resourceHours,
      topAccounts,
      timeline,
      engagementTypes,
    });
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

// ============================================
// LEGACY CHAT ENDPOINT (preserved)
// ============================================

app.post("/chat", async (req, res) => {
  const { input } = req.body;

  if (!input) {
    return res.status(400).json({ error: "Missing input text" });
  }

  try {
    const response = await fetch(`${BASE_URL}/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MATCHA-API-KEY": API_KEY,
      },
      body: JSON.stringify({
        mission_id: MISSION_ID,
        input,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API error:", errorText);
      return res.status(response.status).json({ error: "Matcha API failed" });
    }

    const data = await response.json();
    const outputText = data?.output?.[0]?.content?.[0]?.text || "No response text available.";

    res.json({ status: data.status, outputText });
  } catch (err) {
    console.error("⚠️ Error calling Matcha API:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Serve static files from the "public" directory (for React build)
app.use(express.static(path.join(__dirname, "public")));

// Fallback to index.html for client-side routing
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Matcha SOW Application running at http://localhost:${PORT}`);
});