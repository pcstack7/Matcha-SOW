import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { accountOps, templateOps, sowOps } from "./database.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.MATCHA_API_KEY;
const WORKSPACE_ID = process.env.WORKSPACE_ID || 2010;
const BASE_URL = process.env.BASE_URL || "https://matcha.harriscomputer.com/rest/api/v1";
const MISSION_ID = process.env.MISSION_ID || 7618;

if (!API_KEY) {
  console.error("❌ MATCHA_API_KEY is missing in .env file.");
  process.exit(1);
}

// ============================================
// ACCOUNT MANAGEMENT ENDPOINTS
// ============================================

// Get all accounts
app.get("/api/accounts", (req, res) => {
  try {
    const accounts = accountOps.getAll();
    res.json(accounts);
  } catch (err) {
    console.error("Error fetching accounts:", err);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

// Get account by ID
app.get("/api/accounts/:id", (req, res) => {
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

// Create new account
app.post("/api/accounts", (req, res) => {
  try {
    const { name, company, email, phone, address } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Account name is required" });
    }
    const id = accountOps.create({ name, company, email, phone, address });
    const account = accountOps.getById(id);
    res.status(201).json(account);
  } catch (err) {
    console.error("Error creating account:", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// Update account
app.put("/api/accounts/:id", (req, res) => {
  try {
    const { name, company, email, phone, address } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Account name is required" });
    }
    accountOps.update(req.params.id, { name, company, email, phone, address });
    const account = accountOps.getById(req.params.id);
    res.json(account);
  } catch (err) {
    console.error("Error updating account:", err);
    res.status(500).json({ error: "Failed to update account" });
  }
});

// Delete account
app.delete("/api/accounts/:id", (req, res) => {
  try {
    accountOps.delete(req.params.id);
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Error deleting account:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// ============================================
// TEMPLATE MANAGEMENT ENDPOINTS
// ============================================

// Get all templates
app.get("/api/templates", (req, res) => {
  try {
    const templates = templateOps.getAll();
    res.json(templates);
  } catch (err) {
    console.error("Error fetching templates:", err);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Upload template
app.post("/api/templates", upload.single("file"), async (req, res) => {
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
app.delete("/api/templates/:id", (req, res) => {
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

// ============================================
// SOW MANAGEMENT ENDPOINTS
// ============================================

// Get all SOWs
app.get("/api/sows", (req, res) => {
  try {
    const sows = sowOps.getAll();
    res.json(sows);
  } catch (err) {
    console.error("Error fetching SOWs:", err);
    res.status(500).json({ error: "Failed to fetch SOWs" });
  }
});

// Get SOW by ID
app.get("/api/sows/:id", (req, res) => {
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
app.get("/api/sows/account/:accountId", (req, res) => {
  try {
    const sows = sowOps.getByAccountId(req.params.accountId);
    res.json(sows);
  } catch (err) {
    console.error("Error fetching SOWs:", err);
    res.status(500).json({ error: "Failed to fetch SOWs" });
  }
});

// Generate SOW using AI
app.post("/api/sows/generate", async (req, res) => {
  try {
    const { account_id, template_id, project_notes, deliverables } = req.body;

    if (!account_id || !project_notes || !deliverables) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get account details
    const account = accountOps.getById(account_id);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    // Get template if provided
    let templateContent = "";
    if (template_id) {
      const template = templateOps.getById(template_id);
      if (template && template.content) {
        templateContent = `\n\nUse this template as a reference:\n${template.content}`;
      }
    }

    // Build the AI prompt
    const prompt = `Generate a professional Statement of Work (SOW) document with the following details:

Account: ${account.name}${account.company ? ` (${account.company})` : ""}
Email: ${account.email || "N/A"}
Phone: ${account.phone || "N/A"}
Address: ${account.address || "N/A"}

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

Format the output as a well-structured document.`;

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

    // Save SOW to database
    const id = sowOps.create({
      account_id,
      template_id: template_id || null,
      project_notes,
      deliverables,
      content,
    });

    const sow = sowOps.getById(id);
    res.status(201).json(sow);
  } catch (err) {
    console.error("Error generating SOW:", err);
    res.status(500).json({ error: "Failed to generate SOW" });
  }
});

// Delete SOW
app.delete("/api/sows/:id", (req, res) => {
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

// Export SOW to PDF
app.get("/api/export/:id/pdf", (req, res) => {
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

    // Header
    doc.fontSize(24).fillColor("#151744").text("Statement of Work", { align: "center" });
    doc.moveDown();

    // Account Info
    doc.fontSize(14).fillColor("#393392").text("Client Information", { underline: true });
    doc.fontSize(11).fillColor("#000000");
    doc.text(`Account: ${sow.account_name}`);
    if (sow.account_company) doc.text(`Company: ${sow.account_company}`);
    doc.text(`Date: ${new Date(sow.created_at).toLocaleDateString()}`);
    doc.moveDown();

    // Content
    doc.fontSize(11).fillColor("#000000").text(sow.content, { align: "left" });

    doc.end();
  } catch (err) {
    console.error("Error exporting to PDF:", err);
    res.status(500).json({ error: "Failed to export to PDF" });
  }
});

// Export SOW to DOCX
app.get("/api/export/:id/docx", async (req, res) => {
  try {
    const sow = sowOps.getById(req.params.id);
    if (!sow) {
      return res.status(404).json({ error: "SOW not found" });
    }

    const filename = `SOW-${sow.account_name.replace(/\s+/g, "-")}-${Date.now()}.docx`;

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "Statement of Work",
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 200 },
            }),
            new Paragraph({
              text: "Client Information",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Account: ", bold: true }),
                new TextRun(sow.account_name),
              ],
            }),
            ...(sow.account_company
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Company: ", bold: true }),
                      new TextRun(sow.account_company),
                    ],
                  }),
                ]
              : []),
            new Paragraph({
              children: [
                new TextRun({ text: "Date: ", bold: true }),
                new TextRun(new Date(sow.created_at).toLocaleDateString()),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              text: sow.content,
              spacing: { before: 200 },
            }),
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
app.get("/api/export/:id/txt", (req, res) => {
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
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Matcha SOW Application running at http://localhost:${PORT}`);
});