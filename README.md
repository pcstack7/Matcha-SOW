# Matcha SOW - AI-Powered Statement of Work Generator

A professional Statement of Work (SOW) generation application for sales teams, powered by AI through the Matcha platform.

## Features

### SOW Generation
- Form-based input for account selection, project notes, and deliverables
- Optional template selection for consistent formatting
- AI-powered content generation via Matcha API
- Real-time generation with loading states
- Live preview of generated SOWs

### Template Management
- Upload templates in multiple formats (PDF, DOCX, TXT)
- View all uploaded templates
- Delete templates
- Templates guide AI generation for consistent output

### Account Management
- Create and store client accounts
- Track contact information (name, company, email, phone, address)
- Edit and delete accounts
- Account-based SOW filtering

### Export Functionality
- Export SOWs to PDF with professional formatting
- Export to Microsoft Word (.docx)
- Export to plain text (.txt)
- Automatic filename generation
- Direct download from UI

### Brand Colors

The application uses a cohesive color scheme:

**Primary Palette:**
- Dark Blue: #151744
- Purple: #393392
- Light Purple: #707CF1
- Pink: #F56E7B
- White: #FFFFFF

**Secondary Palette:**
- Blue: #0076A2
- Cyan: #00BBBA

## Technology Stack

### Backend
- Node.js with Express
- SQLite database (better-sqlite3)
- Multer for file uploads
- PDFKit for PDF generation
- docx for DOCX generation
- Matcha API integration

### Frontend
- React 19
- Vite build tool
- Vanilla CSS with CSS variables
- Responsive design

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Matcha-SOW
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
MATCHA_API_KEY=your_api_key_here
WORKSPACE_ID=2010
MISSION_ID=7618
BASE_URL=https://matcha.harriscomputer.com/rest/api/v1
PORT=3000
```

4. Build the frontend:
```bash
npm run build
```

5. Start the server:
```bash
npm run server
```

Or use the combined command:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Development

To run the frontend in development mode with hot reload:

```bash
# Terminal 1 - Run Vite dev server
npm run dev

# Terminal 2 - Run backend server
npm run server
```

The Vite dev server will run on `http://localhost:5173` and proxy API calls to the backend.

## Project Structure

```
Matcha-SOW/
├── src/
│   ├── components/
│   │   ├── AccountManagement.jsx
│   │   ├── TemplateManagement.jsx
│   │   ├── SOWGenerator.jsx
│   │   └── SOWList.jsx
│   ├── services/
│   │   └── api.js
│   ├── styles/
│   │   └── App.css
│   ├── App.jsx
│   └── main.jsx
├── public/
│   └── (build output)
├── uploads/
│   └── templates/
├── database.js
├── server.js
├── vite.config.js
├── package.json
└── README.md
```

## API Endpoints

### Accounts
- `GET /api/accounts` - Get all accounts
- `GET /api/accounts/:id` - Get account by ID
- `POST /api/accounts` - Create new account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

### Templates
- `GET /api/templates` - Get all templates
- `POST /api/templates` - Upload template
- `DELETE /api/templates/:id` - Delete template

### SOWs
- `GET /api/sows` - Get all SOWs
- `GET /api/sows/:id` - Get SOW by ID
- `GET /api/sows/account/:accountId` - Get SOWs by account
- `POST /api/sows/generate` - Generate new SOW
- `DELETE /api/sows/:id` - Delete SOW

### Export
- `GET /api/export/:id/pdf` - Export SOW as PDF
- `GET /api/export/:id/docx` - Export SOW as DOCX
- `GET /api/export/:id/txt` - Export SOW as TXT

## Usage Guide

### Creating an Account

1. Navigate to "Manage Accounts"
2. Click "+ Add Account"
3. Fill in the account details:
   - Name (required)
   - Company
   - Email
   - Phone
   - Address
4. Click "Create Account"

### Uploading a Template

1. Navigate to "Manage Templates"
2. Click "+ Upload Template"
3. Enter a template name
4. Select a file (PDF, DOCX, or TXT)
5. Click "Upload"

### Generating a SOW

1. Navigate to "Generate SOW"
2. Select an account from the dropdown
3. Optionally select a template
4. Enter project notes describing the scope and requirements
5. Enter deliverables (one per line or comma-separated)
6. Click "Generate SOW"
7. Wait for the AI to generate the SOW
8. Preview the generated SOW
9. Export in your preferred format (PDF, DOCX, or TXT)

### Viewing SOW History

1. Navigate to "SOW History"
2. Browse all generated SOWs
3. Filter by account if needed
4. Click "View" to see SOW details
5. Export or delete SOWs as needed

## Database Schema

### Accounts Table
```sql
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Templates Table
```sql
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  content TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### SOWs Table
```sql
CREATE TABLE sows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  template_id INTEGER,
  project_notes TEXT NOT NULL,
  deliverables TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE SET NULL
);
```

## Security Considerations

- API key is stored in `.env` file (not committed to git)
- File uploads are restricted to PDF, DOCX, and TXT
- File upload size limited to 10MB
- SQL injection protection via prepared statements
- Input validation on all API endpoints

## Troubleshooting

### Database errors
- Ensure `sow.db` has proper permissions
- Check if the database file exists (it will be created automatically on first run)

### File upload errors
- Verify the `uploads/templates` directory exists and is writable
- Check file size (max 10MB)
- Ensure file type is supported (PDF, DOCX, or TXT)

### Matcha API errors
- Verify your `MATCHA_API_KEY` is correct in `.env`
- Check your internet connection
- Ensure `WORKSPACE_ID` and `MISSION_ID` are correct

### Build errors
- Delete `node_modules` and run `npm install` again
- Clear the `public` directory and rebuild

## License

ISC

## Support

For issues and feature requests, please contact the development team.
