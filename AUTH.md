# Authentication System - Configuration Guide

## Overview

The Matcha SOW application now includes a comprehensive authentication system with:
- Local username/password authentication
- Azure AD (Microsoft) single sign-on
- Role-based access control (Admin and User roles)
- User management interface for administrators

## Environment Variables

Add these to your `.env` file:

```env
# Session Configuration
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# Azure AD Configuration (Optional - for Azure AD login)
AZURE_AD_CLIENT_ID=your-azure-app-client-id
AZURE_AD_CLIENT_SECRET=your-azure-app-client-secret
AZURE_AD_TENANT_ID=your-azure-tenant-id
AZURE_AD_REDIRECT_URI=http://localhost:3000/auth/azure/callback

# For production, use your domain:
# AZURE_AD_REDIRECT_URI=https://yourdomain.com/auth/azure/callback
```

## Azure AD Setup

### 1. Register Application in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Fill in:
   - **Name:** Matcha SOW Application
   - **Supported account types:** Accounts in this organizational directory only
   - **Redirect URI:**
     - Platform: Web
     - URL: `http://localhost:3000/auth/azure/callback` (dev) or `https://yourdomain.com/auth/azure/callback` (prod)
5. Click **Register**

### 2. Get Client ID and Tenant ID

- Copy the **Application (client) ID** - this is your `AZURE_AD_CLIENT_ID`
- Copy the **Directory (tenant) ID** - this is your `AZURE_AD_TENANT_ID`

### 3. Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Add description: "Matcha SOW Auth"
4. Set expiration (recommend: 24 months)
5. Click **Add**
6. **IMMEDIATELY copy the secret value** - this is your `AZURE_AD_CLIENT_SECRET`
   - ⚠️ You won't be able to see it again!

### 4. Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add these permissions:
   - `User.Read` (Read user profile)
   - `email` (View users' email address)
   - `openid` (Sign users in)
   - `profile` (View users' basic profile)
6. Click **Add permissions**
7. Click **Grant admin consent** (if you're an admin)

## Default Users

The system automatically creates a default admin user on first run:

```
Username: admin
Password: Admin@123
Role: admin
```

**⚠️ IMPORTANT:** Change this password immediately after first login!

## User Roles

### Admin Role
- Full access to all features
- User management (create, edit, delete users)
- Can promote/demote user roles
- Access to all SOWs, accounts, and templates

### User Role
- Can create and manage their own content
- Cannot access user management
- Cannot change user roles

## API Endpoints

### Authentication Endpoints

```
POST   /auth/register          - Register new local user
POST   /auth/login             - Login with username/password
GET    /auth/azure             - Initiate Azure AD login
GET    /auth/azure/callback    - Azure AD callback handler
POST   /auth/logout            - Logout current user
GET    /auth/session           - Get current session info
```

### User Management Endpoints (Admin only)

```
GET    /api/users              - Get all users
GET    /api/users/:id          - Get user by ID
POST   /api/users              - Create new user
PUT    /api/users/:id          - Update user
DELETE /api/users/:id          - Delete user
PUT    /api/users/:id/password - Change user password
```

## UI Components

### Login Page
- Username/password login form
- "Sign in with Microsoft" button (if Azure AD configured)
- Form validation and error display

### User Management (Admin only)
- List all users with their roles and status
- Create new users
- Edit user details and roles
- Activate/deactivate users
- Delete users (with protection against deleting last admin)
- Change user passwords

## Security Features

1. **Password Hashing:** All passwords are hashed with bcrypt (10 rounds)
2. **Session Management:** Secure session cookies with configurable secrets
3. **Role-Based Access:** Middleware to protect routes by role
4. **CSRF Protection:** (Recommended to add in production)
5. **Last Admin Protection:** Cannot delete the last active admin
6. **Account Locking:** Inactive users cannot log in

## Testing Authentication

### Test Local Authentication

```bash
# Register a new user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test@123",
    "displayName": "Test User"
  }'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin@123"
  }' \
  -c cookies.txt

# Check session
curl http://localhost:3000/auth/session -b cookies.txt

# Logout
curl -X POST http://localhost:3000/auth/logout -b cookies.txt
```

### Test Azure AD Authentication

1. Open browser to `http://localhost:3000`
2. Click "Sign in with Microsoft"
3. Login with your Microsoft account
4. Authorize the application
5. You'll be redirected back and logged in

## Database Schema

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,              -- NULL for Azure AD users
  role TEXT NOT NULL DEFAULT 'user',
  auth_provider TEXT DEFAULT 'local',  -- 'local' or 'azure'
  azure_id TEXT UNIQUE,            -- Azure AD object ID
  display_name TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);
```

## Troubleshooting

### Azure AD Login Fails

1. **Check Redirect URI:** Must match exactly in Azure and .env
2. **Check Permissions:** Ensure all Microsoft Graph permissions are granted
3. **Check Tenant ID:** Verify it's the correct directory tenant ID
4. **Check Client Secret:** Ensure it hasn't expired

### Session Not Persisting

1. **Check SESSION_SECRET:** Must be set in .env
2. **Check Cookies:** Browser must accept cookies
3. **Check HTTPS:** In production, ensure secure cookies are enabled

### Cannot Login as Admin

1. **Check Default User:** Run server, it should create default admin
2. **Check Database:** Verify user exists: `sqlite3 sow.db "SELECT * FROM users;"`
3. **Reset Password:** See "Resetting Admin Password" below

## Resetting Admin Password

```bash
# Using Node.js REPL
node
> const bcrypt = require('bcryptjs');
> const hash = bcrypt.hashSync('NewPassword@123', 10);
> console.log(hash);
# Copy the hash

# Update database
sqlite3 sow.db
UPDATE users SET password_hash = 'paste-hash-here' WHERE username = 'admin';
.exit
```

## Production Deployment

1. **Change SESSION_SECRET:** Use a strong random string
2. **Change Default Password:** Login and change admin password immediately
3. **Enable HTTPS:** Required for secure cookies
4. **Set Secure Cookies:** Update session configuration for production
5. **Configure CORS:** If frontend is on different domain
6. **Rate Limiting:** Add rate limiting to auth endpoints
7. **Audit Logging:** Track login attempts and user changes

## Migration from Non-Auth Version

If you're upgrading from a version without authentication:

1. **Backup Database:** `cp sow.db sow.db.backup`
2. **Run Server:** It will automatically create users table
3. **Login as Admin:** Use default credentials
4. **Create Users:** Add accounts for your team
5. **Test Thoroughly:** Ensure all features work with auth enabled

## Next Steps

After setting up authentication:

1. Change the default admin password
2. Create user accounts for your team
3. Configure Azure AD (if using SSO)
4. Test all authentication flows
5. Set up proper session management for production
6. Consider adding 2FA for additional security

## Support

For issues related to:
- **Azure AD:** Check [Microsoft Identity Platform docs](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- **Session Management:** Check Express Session docs
- **Password Security:** Ensure following OWASP guidelines

