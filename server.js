// testMatchaAuth.js

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
//app.use(express.json());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Serve static files from the "public" directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// Replace with your actual API key, or use an environment variable
const API_KEY = process.env.MATCHA_API_KEY;
const WORKSPACE_ID = process.env.WORKSPACE_ID || 2010; // Default workspace_id = 2010 for testing
const BASE_URL = process.env.BASE_URL || "https://matcha.harriscomputer.com/rest/api/v1";
const MISSION_ID = process.env.MISSION_ID || 7618; // Default mission_id = 7618 for testing

if (!API_KEY) {
  console.error("❌ MATCHA_API_KEY is missing in .env file.");
  process.exit(1);
}

// Route to handle chat requests
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

    // Extract assistant text before sending back
    const outputText = data?.output?.[0]?.content?.[0]?.text || "No response text available.";

    res.json({status: data.status, outputText});
  } catch (err) {
    console.error("⚠️ Error calling Matcha API:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Matcha Chat running at http://localhost:${PORT}`);
});