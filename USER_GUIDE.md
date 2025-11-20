# Matcha-SOW User Guide

**Version 1.0**
**Last Updated: November 2025**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Dashboard](#dashboard)
5. [Generating SOWs](#generating-sows)
6. [SOW History](#sow-history)
7. [SOW Knowledge Bank](#sow-knowledge-bank)
8. [Master Data Management](#master-data-management)
9. [Template Management](#template-management)
10. [User Management](#user-management)
11. [Account Settings](#account-settings)
12. [Export Options](#export-options)
13. [Troubleshooting](#troubleshooting)

---

## Introduction

### What is Matcha-SOW?

Matcha-SOW is an AI-powered Statement of Work (SOW) generator designed to streamline the creation, management, and tracking of professional SOW documents for sales and delivery teams. The application leverages artificial intelligence to generate comprehensive, professional SOWs based on your project requirements, historical templates, and organizational knowledge.

**[Image Placeholder: Matcha-SOW Dashboard Overview]**

### Key Features

- **AI-Powered SOW Generation**: Automatically generate professional SOWs using artificial intelligence
- **Template-Based Generation**: Use existing SOW templates to guide AI content creation
- **Multi-Format Export**: Export SOWs to PDF, DOCX, or TXT formats
- **Knowledge Bank**: Store and reference historical SOWs with pricing and resource data
- **Comprehensive Analytics**: Track SOW metrics, pricing trends, and resource allocation
- **Role-Based Access Control**: Separate permissions for administrators and regular users
- **Multi-Account Management**: Organize SOWs by client accounts
- **Resource Tracking**: Monitor hours allocation across different roles

---

## Getting Started

### First-Time Login

When you first access Matcha-SOW, you'll be presented with a login screen.

**[Image Placeholder: Login Screen]**

#### Default Administrator Credentials

If you're the first administrator setting up the system:
- **Username**: `admin`
- **Password**: `Admin@123`

**Important**: You will be required to change this password after your first login for security purposes.

#### Logging In

1. Navigate to the Matcha-SOW application URL
2. Enter your username and password
3. Click the "Login" button
4. If using Azure AD (SSO), click the "Login with Microsoft" button instead

**[Image Placeholder: Login Process]**

### Understanding the Interface

After logging in, you'll see the main application interface consisting of:

1. **Sidebar Navigation**: Located on the left side, providing access to all application features
2. **Main Content Area**: Displays the currently selected page or feature
3. **User Information**: Shows your username and provides access to logout functionality

**[Image Placeholder: Main Interface Layout with Labeled Components]**

---

## User Roles & Permissions

Matcha-SOW implements role-based access control with two primary user roles:

### Administrator Role

Administrators have full access to all application features, including:

- ✓ Generate and manage SOWs
- ✓ View and analyze dashboard analytics
- ✓ Create, edit, and delete user accounts
- ✓ Manage master data (Accounts, Products, Engagement Types)
- ✓ Upload and manage templates
- ✓ Manage SOW Knowledge Bank
- ✓ Change passwords for all users
- ✓ Assign and modify user roles

**[Image Placeholder: Admin Sidebar Navigation]**

### User Role

Regular users have access to core SOW generation features:

- ✓ Generate and manage SOWs
- ✓ View dashboard analytics
- ✓ View master data (Accounts, Products, Engagement Types)
- ✓ Upload and manage templates
- ✓ View and upload to SOW Knowledge Bank
- ✓ Change their own password
- ✗ Cannot create or modify master data
- ✗ Cannot manage other users
- ✗ Cannot access user management features

**[Image Placeholder: User Sidebar Navigation]**

---

## Dashboard

The Dashboard provides a comprehensive overview of your SOW operations, analytics, and key metrics.

**[Image Placeholder: Complete Dashboard View]**

### Summary Metrics

At the top of the dashboard, you'll find four key metrics:

1. **Total Generated SOWs**: Count of all AI-generated SOWs in the system
2. **Total Uploaded SOWs**: Count of all SOWs uploaded to the Knowledge Bank
3. **Total Accounts**: Number of client accounts in the system
4. **Active Users**: Number of currently active user accounts

**[Image Placeholder: Summary Metrics Cards]**

### Pricing Analytics

The pricing section displays currency-specific metrics:

- **Average Pricing**: Mean SOW value per currency
- **Minimum Pricing**: Lowest SOW value per currency
- **Maximum Pricing**: Highest SOW value per currency
- **SOW Count**: Number of SOWs per currency

Supported currencies: USD, AUD, SGD

**[Image Placeholder: Pricing Analytics Section]**

### Top Accounts by SOW Count

This section displays a ranked list of your most active client accounts based on the number of SOWs created for each account.

**Use Case**: Identify your most engaged clients and prioritize account management efforts.

**[Image Placeholder: Top Accounts Chart]**

### Pricing by Account

View the top 10 accounts ranked by total SOW pricing value. This helps identify your highest-value client relationships.

**[Image Placeholder: Pricing by Account Chart]**

### Pricing by Product

Analyze revenue distribution across your product portfolio. This chart shows which products generate the most SOW value.

**Use Case**: Inform product strategy and sales focus areas.

**[Image Placeholder: Pricing by Product Chart]**

### Pricing by User

Track individual user productivity by viewing total SOW pricing generated by each team member.

**Use Case**: Performance tracking and resource allocation decisions.

**[Image Placeholder: Pricing by User Chart]**

### SOW Timeline

View a 12-month trend analysis showing the number of SOWs created over time, separated by:
- **Generated SOWs** (AI-created)
- **Uploaded SOWs** (manually uploaded to Knowledge Bank)

**[Image Placeholder: SOW Timeline Graph]**

### Resource Hours Analysis

See a breakdown of resource allocation across different roles:

- **PM Hours**: Project Manager
- **IC Hours**: Implementation Consultant
- **SA Hours**: Solutions Architect
- **SE Hours**: Software Engineer
- **Trainer Hours**: Training and enablement
- **Integration Hours**: Systems integration work
- **APAC Testing Hours**: Testing resources
- **APAC R&D Hours**: Research and development

This data is collected from SOWs uploaded to the Knowledge Bank.

**[Image Placeholder: Resource Hours Breakdown Chart]**

### Engagement Type Distribution

View the distribution of SOWs across different engagement types (e.g., Implementation, Advisory, Managed Services).

**[Image Placeholder: Engagement Type Distribution Pie Chart]**

---

## Generating SOWs

The SOW Generator is the core feature of Matcha-SOW, allowing you to create professional Statement of Work documents using AI.

**[Image Placeholder: SOW Generator Page Overview]**

### Accessing the SOW Generator

1. Click on **"Generate SOW"** in the sidebar navigation
2. The SOW Generation form will appear in the main content area

### Understanding the Generation Form

The form consists of the following fields:

#### 1. Account (Required)

Select the client account for which you're creating the SOW.

- **Purpose**: Links the SOW to a specific client
- **Required**: Yes
- **Format**: Dropdown selection

**[Image Placeholder: Account Selection Dropdown]**

**Note**: If the account you need doesn't exist, contact an administrator to create it in the Accounts Master.

#### 2. Template (Optional)

Select a reference template to guide the AI generation process.

- **Purpose**: Provides the AI with formatting and content structure examples
- **Required**: No
- **Format**: Dropdown selection
- **Recommendation**: Using a template generally produces better, more consistent results

**[Image Placeholder: Template Selection Dropdown]**

**Note**: Templates must be uploaded via the "Manage Templates" section before they appear in this list.

#### 3. Product (Optional)

Select the product or solution that this SOW covers.

- **Purpose**: Provides context to the AI about the specific product/solution
- **Required**: No
- **Format**: Dropdown selection

**[Image Placeholder: Product Selection Dropdown]**

#### 4. Engagement Type (Optional)

Specify the type of engagement this SOW represents.

- **Purpose**: Categorizes the SOW and helps the AI understand the engagement model
- **Required**: No
- **Format**: Dropdown selection
- **Examples**: Implementation, Advisory, Managed Services, Professional Services

**[Image Placeholder: Engagement Type Selection Dropdown]**

#### 5. Project Notes (Required)

Provide detailed information about the project scope and requirements.

- **Purpose**: Primary input for AI to understand the project context
- **Required**: Yes
- **Format**: Multi-line text area
- **Best Practices**:
  - Be specific and detailed
  - Include project objectives
  - Mention any constraints or special requirements
  - Specify timeline expectations
  - Include stakeholder information

**[Image Placeholder: Project Notes Text Area with Example]**

**Example Project Notes**:
```
Client requires implementation of our CRM solution across 3 regional offices
(New York, London, Singapore). Project includes data migration from legacy
system, custom integration with existing ERP, and training for 150 users.
Timeline: 6 months. Client has requested dedicated project management and
24/7 support during go-live phases.
```

#### 6. Deliverables (Required)

List the specific deliverables that will be provided as part of this engagement.

- **Purpose**: Defines the tangible outputs of the project
- **Required**: Yes
- **Format**: Multi-line text area
- **Best Practices**:
  - Use bullet points or numbered lists
  - Be specific and measurable
  - Include documentation deliverables
  - Specify delivery timelines if applicable

**[Image Placeholder: Deliverables Text Area with Example]**

**Example Deliverables**:
```
1. Fully configured CRM system across all 3 regional instances
2. Data migration from legacy system (all historical data from past 5 years)
3. Custom ERP integration module with real-time synchronization
4. User training program (3 sessions per location, materials included)
5. System documentation (technical and user guides)
6. 90-day post-implementation support
7. Go-live support (on-site for first week)
```

### Generating the SOW

1. Fill in all required fields (Account, Project Notes, Deliverables)
2. Optionally complete additional fields for better results
3. Click the **"Generate SOW"** button
4. Wait while the AI processes your request (typically 10-30 seconds)
5. Review the generated SOW content

**[Image Placeholder: Generate Button and Loading State]**

### Reviewing Generated Content

Once generation is complete, the SOW content will appear below the form.

**[Image Placeholder: Generated SOW Preview]**

The generated SOW typically includes:

- Executive Summary
- Project Scope
- Deliverables
- Timeline and Milestones
- Resource Allocation
- Terms and Conditions
- Acceptance Criteria

### What to Do After Generation

After reviewing the generated SOW, you have several options:

1. **Export the SOW**: Download in PDF, DOCX, or TXT format
2. **Regenerate**: If not satisfied, modify your inputs and generate again
3. **Save to History**: The SOW is automatically saved to your SOW History

**[Image Placeholder: Post-Generation Action Buttons]**

---

## SOW History

The SOW History page displays all SOWs that have been generated in the system, allowing you to search, filter, and manage past SOWs.

**[Image Placeholder: SOW History Page Overview]**

### Accessing SOW History

1. Click on **"SOW History"** in the sidebar navigation
2. You'll see a list of all generated SOWs

### Understanding the SOW List

Each SOW entry displays:

- **SOW ID**: Unique identifier
- **Account Name**: Client account associated with the SOW
- **Product**: Product linked to the SOW (if specified)
- **Engagement Type**: Type of engagement (if specified)
- **Created By**: User who generated the SOW
- **Created Date**: Timestamp of creation
- **Actions**: View, Export, Delete buttons

**[Image Placeholder: SOW List Table with Sample Entries]**

### Searching and Filtering

Use the search and filter capabilities to find specific SOWs:

1. **Search Bar**: Enter keywords to search across SOW content
2. **Account Filter**: Filter by specific client account
3. **Product Filter**: Filter by product
4. **Date Range Filter**: Select a specific time period

**[Image Placeholder: Search and Filter Controls]**

### Viewing a SOW

1. Click the **"View"** button next to any SOW entry
2. The full SOW content will be displayed
3. From the view page, you can:
   - Read the complete content
   - Export to different formats
   - Return to the list

**[Image Placeholder: SOW Detail View]**

### Exporting SOWs

From the SOW History page, you can export any SOW:

1. Click the **"Export"** dropdown button
2. Select your desired format:
   - **PDF**: Professional PDF document
   - **DOCX**: Microsoft Word document
   - **TXT**: Plain text file
3. The file will download to your computer

**[Image Placeholder: Export Options Dropdown]**

See the [Export Options](#export-options) section for more details on export formats.

### Deleting SOWs

Administrators can delete SOWs from the history:

1. Click the **"Delete"** button next to the SOW
2. Confirm the deletion in the popup dialog
3. The SOW will be permanently removed

**Warning**: Deletion is permanent and cannot be undone.

**[Image Placeholder: Delete Confirmation Dialog]**

---

## SOW Knowledge Bank

The SOW Knowledge Bank is a repository for uploaded historical SOWs that serves as both a reference library and a data source for analytics.

**[Image Placeholder: SOW Knowledge Bank Overview]**

### Purpose of the Knowledge Bank

The Knowledge Bank serves multiple purposes:

1. **Reference Library**: Store successful SOWs for team reference
2. **Pricing Intelligence**: Track historical pricing data
3. **Resource Planning**: Analyze resource hours allocation
4. **Best Practices**: Learn from past successful engagements

### Viewing Uploaded SOWs

The Knowledge Bank displays all uploaded SOWs with the following information:

- **File Name**: Original file name
- **Account**: Associated client account
- **Product**: Related product
- **Engagement Type**: Type of engagement
- **Pricing**: SOW value and currency
- **Resource Hours**: Breakdown by role
- **Status**: Active or Inactive
- **Uploaded By**: User who uploaded the SOW
- **Upload Date**: Timestamp

**[Image Placeholder: Knowledge Bank List View]**

### Uploading a SOW to the Knowledge Bank

To add a historical SOW to the Knowledge Bank:

1. Click the **"Upload SOW"** button
2. Fill in the upload form (see below)
3. Click **"Submit"**

**[Image Placeholder: Upload SOW Button and Form]**

#### Upload Form Fields

**File Upload** (Required)
- Supported formats: PDF, DOCX, TXT
- Maximum file size: 10MB
- The actual SOW document file

**Account** (Required)
- Select the client account this SOW was created for
- Links the SOW to analytics and reporting

**Product** (Optional)
- Select the product or solution this SOW covers
- Used for product-based analytics

**Engagement Type** (Optional)
- Specify the type of engagement
- Used for engagement analysis

**Description** (Optional)
- Provide context about this SOW
- Note any special circumstances or outcomes

**Pricing Amount** (Optional)
- Enter the total SOW value
- Used for pricing analytics and benchmarking

**Currency** (Optional)
- Select USD, AUD, or SGD
- Must be specified if pricing is entered

**[Image Placeholder: Upload Form - Basic Information Section]**

#### Resource Hours Fields (Optional but Recommended)

Track the resource allocation by entering hours for each role:

- **PM Hours**: Project Manager hours
- **IC Hours**: Implementation Consultant hours
- **SA Hours**: Solutions Architect hours
- **SE Hours**: Software Engineer hours
- **Trainer Hours**: Training and enablement hours
- **Integration Hours**: Systems integration hours
- **APAC Testing Hours**: Testing resources
- **APAC R&D Hours**: Research and development hours

**[Image Placeholder: Upload Form - Resource Hours Section]**

**Why Track Resource Hours?**
- Improves future project estimates
- Helps with resource planning
- Enables capacity management
- Supports pricing decisions

### Editing Uploaded SOWs

To modify the metadata of an uploaded SOW:

1. Click the **"Edit"** button next to the SOW entry
2. Update the fields you want to change
3. Click **"Save Changes"**

**Note**: You can edit metadata but not the uploaded file itself. To replace a file, delete the entry and upload a new one.

**[Image Placeholder: Edit SOW Dialog]**

### Activating/Deactivating SOWs

You can toggle the active status of uploaded SOWs:

- **Active SOWs**: Included in analytics and visible in all views
- **Inactive SOWs**: Hidden from analytics but retained in the system

To change status:
1. Click the **"Deactivate"** or **"Activate"** button
2. The status will change immediately

**[Image Placeholder: Activate/Deactivate Toggle]**

### Deleting SOWs from Knowledge Bank

To permanently remove a SOW:

1. Click the **"Delete"** button
2. Confirm the deletion
3. The SOW and its file will be permanently removed

**[Image Placeholder: Delete Confirmation]**

---

## Master Data Management

Master data consists of the core reference information used throughout the application. This section is primarily for administrators.

### Accounts Master

Accounts represent your client organizations. Each SOW must be linked to an account.

**[Image Placeholder: Accounts Management Page]**

#### Viewing Accounts

The Accounts page displays all client accounts with:
- Account Name
- Contact Name
- Email
- Phone
- Status (Active/Inactive)
- Created Date
- Actions

**Filter Options**:
- All Accounts
- Active Only
- Inactive Only

**[Image Placeholder: Accounts List with Filters]**

#### Creating an Account (Admin Only)

1. Click **"Add New Account"**
2. Fill in the account form:
   - **Account Name** (Required): Client organization name
   - **Account Contact/Company Name** (Optional): Primary contact
   - **Email** (Optional): Contact email
   - **Phone** (Optional): Contact phone number
   - **Notes/Address** (Optional): Additional information
   - **Status**: Active or Inactive
3. Click **"Create Account"**

**[Image Placeholder: Create Account Form]**

**Best Practices**:
- Use consistent naming conventions
- Include full legal entity names
- Keep contact information up to date
- Use notes field for important context

#### Editing an Account (Admin Only)

1. Click the **"Edit"** button next to the account
2. Modify the fields you want to change
3. Click **"Save Changes"**

**[Image Placeholder: Edit Account Dialog]**

#### Deactivating an Account (Admin Only)

Instead of deleting accounts, you can deactivate them:

1. Click the **"Deactivate"** button
2. The account will be marked as inactive
3. Inactive accounts don't appear in dropdown lists but historical data is preserved

To reactivate: Click the **"Activate"** button

**[Image Placeholder: Deactivate Button]**

### Products Master

Products represent the solutions and offerings your organization sells.

**[Image Placeholder: Products Management Page]**

#### Viewing Products

The Products page displays:
- Product Name
- Portfolio
- Description
- Status (Active/Inactive)
- Actions

**[Image Placeholder: Products List]**

#### Creating a Product (Admin Only)

1. Click **"Add New Product"**
2. Fill in the product form:
   - **Product Name** (Required): Name of the product/solution
   - **Portfolio** (Optional): Product portfolio or category
   - **Description** (Optional): Detailed product description
   - **Status**: Active or Inactive
3. Click **"Create Product"**

**[Image Placeholder: Create Product Form]**

#### Editing a Product (Admin Only)

1. Click the **"Edit"** button
2. Update the fields
3. Click **"Save Changes"**

**[Image Placeholder: Edit Product Dialog]**

#### Managing Product Status (Admin Only)

Use **"Deactivate"** and **"Activate"** buttons to manage product availability without deleting historical references.

**[Image Placeholder: Product Status Toggle]**

### Engagement Types

Engagement Types categorize the nature of client engagements.

**[Image Placeholder: Engagement Types Management Page]**

#### Viewing Engagement Types

The Engagement Types page displays:
- Type Name
- Category
- Description
- Status (Active/Inactive)
- Actions

**[Image Placeholder: Engagement Types List]**

#### Creating an Engagement Type (Admin Only)

1. Click **"Add New Engagement Type"**
2. Fill in the form:
   - **Type Name** (Required): Name of the engagement type
   - **Category** (Optional): Broader category grouping
   - **Description** (Optional): Explanation of this engagement type
   - **Status**: Active or Inactive
3. Click **"Create Engagement Type"**

**[Image Placeholder: Create Engagement Type Form]**

**Common Engagement Types**:
- Implementation
- Professional Services
- Managed Services
- Advisory/Consulting
- Support and Maintenance
- Training and Enablement

#### Editing an Engagement Type (Admin Only)

1. Click the **"Edit"** button
2. Update the fields
3. Click **"Save Changes"**

**[Image Placeholder: Edit Engagement Type Dialog]**

#### Managing Status (Admin Only)

Use **"Deactivate"** and **"Activate"** buttons to control which engagement types are available for selection.

**[Image Placeholder: Status Management Buttons]**

---

## Template Management

Templates guide the AI in generating SOWs by providing structure and formatting examples.

**[Image Placeholder: Template Management Page Overview]**

### Why Use Templates?

- **Consistency**: Ensure all SOWs follow your organization's standards
- **Quality**: Provide the AI with proven successful examples
- **Efficiency**: Reduce the need for post-generation editing
- **Branding**: Maintain your organization's tone and style

### Viewing Templates

The Templates page displays all uploaded templates with:
- Template Name
- File Type (PDF, DOCX, TXT)
- Upload Date
- Uploaded By
- Actions (View, Delete)

**[Image Placeholder: Templates List]**

### Uploading a Template

Both administrators and regular users can upload templates.

1. Click the **"Upload Template"** button
2. Fill in the upload form:
   - **Template File** (Required): Select your SOW template file
     - Supported formats: PDF, DOCX, TXT
     - Maximum file size: 10MB
   - **Template Name** (Optional): Custom name (defaults to filename)
3. Click **"Upload"**

**[Image Placeholder: Upload Template Form]**

The system will:
- Extract the content from the file
- Store the file securely
- Make it available for SOW generation

**Best Practices for Templates**:
- Use well-structured, professional SOW documents
- Include clear section headings
- Ensure the template represents your best work
- Remove any sensitive or client-specific information
- Include examples of all sections you want in generated SOWs

### Viewing Template Content

To preview what content was extracted from a template:

1. Click the **"View"** button next to the template
2. A preview of the extracted content will be displayed
3. This shows what the AI "sees" when using this template

**[Image Placeholder: Template Content Preview]**

### Deleting Templates

To remove a template:

1. Click the **"Delete"** button
2. Confirm the deletion
3. The template will be removed from the system

**Note**: Deleting a template does not affect SOWs that were previously generated using that template.

**[Image Placeholder: Delete Template Confirmation]**

---

## User Management

User Management is available exclusively to administrators for managing team members and their access.

**[Image Placeholder: User Management Page Overview]**

### Viewing Users

The User Management page displays all user accounts with:
- Username
- Email
- Display Name
- Role (Admin or User)
- Auth Provider (Local or Azure AD)
- Status (Active or Inactive)
- Last Login
- Actions

**[Image Placeholder: Users List Table]**

### Creating a New User (Admin Only)

1. Click the **"Add New User"** button
2. Fill in the user creation form:
   - **Username** (Required): Unique username for login
   - **Email** (Required): User's email address (must be unique)
   - **Display Name** (Optional): Full name for display purposes
   - **Password** (Required): Initial password
   - **Confirm Password** (Required): Confirm the password
   - **Role** (Required): Select Admin or User
   - **Status**: Active or Inactive
3. Click **"Create User"**

**[Image Placeholder: Create User Form]**

**Password Requirements**:
- Minimum 8 characters
- Include uppercase and lowercase letters
- Include at least one number
- Include at least one special character

**Best Practices**:
- Provide users with their credentials securely
- Encourage users to change their password on first login
- Use descriptive display names for easy identification
- Start with User role and promote to Admin only when necessary

### Editing User Details (Admin Only)

1. Click the **"Edit"** button next to a user
2. Modify the fields (except username)
3. Click **"Save Changes"**

**[Image Placeholder: Edit User Dialog]**

**Editable Fields**:
- Email
- Display Name
- Role
- Status

**Non-editable Fields**:
- Username (permanent)
- Auth Provider (set at creation)

### Changing User Roles (Admin Only)

To promote or demote a user:

1. Edit the user
2. Change the **Role** dropdown selection
3. Save changes

**Important**: You cannot demote the last active administrator in the system. At least one active administrator must exist at all times.

**[Image Placeholder: Role Selection Dropdown]**

### Changing User Passwords (Admin Only)

As an administrator, you can reset passwords for any user:

1. Click the **"Change Password"** button next to a user
2. Enter the new password
3. Confirm the new password
4. Click **"Change Password"**

**[Image Placeholder: Admin Password Change Dialog]**

**Use Cases**:
- User forgot their password
- Security concern requiring password reset
- Initial setup requiring temporary password

### Activating/Deactivating Users (Admin Only)

Instead of deleting users, you can deactivate them:

- **Active Users**: Can log in and use the system
- **Inactive Users**: Cannot log in; all their historical data is preserved

To change status:
1. Edit the user
2. Toggle the **Status** field
3. Save changes

**[Image Placeholder: User Status Toggle]**

**When to Deactivate**:
- Employee leaving the organization
- Temporary suspension of access
- Account security concerns

**When to Reactivate**:
- Employee returning
- Access restoration after security review

### Deleting Users (Admin Only)

To permanently remove a user:

1. Click the **"Delete"** button
2. Confirm the deletion
3. The user account will be permanently removed

**Warning**:
- User deletion is permanent
- Historical SOWs created by the user will remain but show the deleted user's ID
- You cannot delete the last active administrator

**[Image Placeholder: Delete User Confirmation]**

---

## Account Settings

### Changing Your Password

All users can change their own password at any time.

**[Image Placeholder: Change Password Page]**

#### To Change Your Password:

1. Click **"Change Password"** in the sidebar navigation
2. Fill in the password change form:
   - **Current Password** (Required): Your existing password
   - **New Password** (Required): Your new password
   - **Confirm New Password** (Required): Re-enter new password
3. Click **"Change Password"**

**[Image Placeholder: Change Password Form]**

**Password Requirements**:
- Minimum 8 characters
- Must be different from current password
- Include a mix of uppercase, lowercase, numbers, and special characters (recommended)

**Security Best Practices**:
- Change your password regularly (every 90 days recommended)
- Don't reuse old passwords
- Don't share your password with others
- Use a unique password for this application
- Consider using a password manager

### Viewing Your Profile Information

Your profile information is displayed in the application header:
- Username
- Role (Admin or User)

**[Image Placeholder: User Profile Display in Header]**

To update your email or display name, contact an administrator.

---

## Export Options

Matcha-SOW supports exporting SOWs in multiple formats to suit different use cases.

**[Image Placeholder: Export Options Interface]**

### Available Export Formats

#### PDF Export

**Format**: Portable Document Format (.pdf)
**Best For**:
- Client presentations
- Final deliverables
- Print-ready documents
- Professional sharing

**Features**:
- Professional Verdana font formatting
- Preserved layout and structure
- Page breaks at appropriate sections
- Read-only format

**[Image Placeholder: Sample PDF Export]**

**To Export as PDF**:
1. Navigate to SOW History or view a specific SOW
2. Click the **"Export"** button
3. Select **"PDF"**
4. The file will download as `SOW-[ID].pdf`

#### DOCX Export

**Format**: Microsoft Word Document (.docx)
**Best For**:
- Editable documents
- Further customization needed
- Collaboration and review
- Template creation

**Features**:
- Full editing capabilities
- Preserved formatting with styles
- Tables and structure maintained
- Compatible with Microsoft Word and alternatives

**[Image Placeholder: Sample DOCX Export]**

**To Export as DOCX**:
1. Navigate to SOW History or view a specific SOW
2. Click the **"Export"** button
3. Select **"DOCX"**
4. The file will download as `SOW-[ID].docx`

#### TXT Export

**Format**: Plain Text (.txt)
**Best For**:
- Content extraction
- System integration
- Simple viewing
- Copy-paste operations

**Features**:
- No formatting (plain text only)
- Universal compatibility
- Smallest file size
- Easy parsing for automation

**[Image Placeholder: Sample TXT Export]**

**To Export as TXT**:
1. Navigate to SOW History or view a specific SOW
2. Click the **"Export"** button
3. Select **"TXT"**
4. The file will download as `SOW-[ID].txt`

### Export Best Practices

- **For Clients**: Use PDF format for professional appearance and to prevent editing
- **For Internal Review**: Use DOCX format to allow comments and modifications
- **For Integration**: Use TXT format for system-to-system transfers
- **File Organization**: Save exports with descriptive names including client name and date
- **Version Control**: Track versions when making edits to exported documents

### Bulk Export

Currently, SOWs must be exported individually. For bulk export needs, contact your administrator about custom export scripts.

---

## Troubleshooting

### Common Issues and Solutions

#### Login Issues

**Problem**: Cannot log in with credentials
**Solutions**:
- Verify username and password are entered correctly (case-sensitive)
- Check if your account is active (contact administrator)
- Clear browser cache and cookies
- Try a different browser
- If using Azure AD, ensure your Microsoft account is correctly configured

**[Image Placeholder: Login Error Message]**

---

**Problem**: "Invalid credentials" error
**Solutions**:
- Reset your password (contact administrator)
- Ensure Caps Lock is not enabled
- Copy-paste credentials to avoid typos

---

#### SOW Generation Issues

**Problem**: SOW generation takes too long
**Solutions**:
- Wait up to 60 seconds for AI processing
- Check your internet connection
- If still loading, refresh and try again
- Contact administrator if problem persists

---

**Problem**: Generated SOW quality is poor
**Solutions**:
- Use a template for better results
- Provide more detailed project notes
- Be specific in deliverables
- Include context about the client and their needs
- Review and refine your inputs

---

**Problem**: Cannot select an account
**Solutions**:
- Ensure accounts exist in the system (check Accounts Master)
- Verify accounts are active (Admin can reactivate)
- Refresh the page to reload the dropdown list

---

#### Upload Issues

**Problem**: Template upload fails
**Solutions**:
- Check file size is under 10MB
- Verify file format is PDF, DOCX, or TXT
- Ensure file is not corrupted (try opening it first)
- Check for special characters in filename
- Try a different file

**[Image Placeholder: Upload Error Message]**

---

**Problem**: Uploaded template content looks wrong
**Solutions**:
- Some complex formatting may not extract perfectly
- Try converting complex PDFs to DOCX first
- Use simpler document formatting
- Add manual formatting in generated SOWs if needed

---

#### Export Issues

**Problem**: Export button doesn't work
**Solutions**:
- Check if pop-up blocker is preventing download
- Verify browser allows downloads from this site
- Try a different browser
- Contact administrator if problem persists

---

**Problem**: Exported document formatting is incorrect
**Solutions**:
- PDF exports have fixed formatting - use DOCX for editing
- Check the source SOW content is correctly formatted
- Regenerate the SOW if content appears corrupted
- Report formatting issues to administrator

---

#### Permission Issues

**Problem**: "Access Denied" or missing menu items
**Solutions**:
- Check your user role (User vs Admin)
- Some features are admin-only
- Contact administrator if you need elevated permissions
- Verify your account is active

**[Image Placeholder: Access Denied Message]**

---

**Problem**: Cannot edit master data
**Solution**:
- Master data editing is admin-only
- Request administrator assistance
- Users can only view master data

---

#### Performance Issues

**Problem**: Application loads slowly
**Solutions**:
- Check your internet connection speed
- Clear browser cache
- Close unnecessary browser tabs
- Try during off-peak hours
- Contact administrator about server performance

---

**Problem**: Dashboard analytics not loading
**Solutions**:
- Refresh the page
- Ensure there is data in the system to display
- Check browser console for errors (F12)
- Contact administrator with error details

---

### Getting Help

#### For Technical Issues

1. **Check this user guide** for solutions
2. **Contact your administrator** for account-related issues
3. **Document the issue**:
   - What were you trying to do?
   - What error message appeared?
   - What browser are you using?
   - Can you reproduce the issue?

#### For Feature Requests

Contact your administrator with:
- Description of desired feature
- Use case and benefit
- How it would improve your workflow

#### For Administrator Support

Administrators can access:
- Application logs in the server console
- Database for data verification
- System configuration files
- Deployment documentation in `DEPLOYMENT.md`

---

## Appendix

### Keyboard Shortcuts

- **Tab**: Navigate between form fields
- **Enter**: Submit forms (when focused on input)
- **Esc**: Close modals and dialogs (where applicable)

### File Size Limits

- **Templates**: 10MB maximum
- **Knowledge Bank SOWs**: 10MB maximum

### Supported File Types

- **Templates**: PDF, DOCX, TXT
- **Knowledge Bank**: PDF, DOCX, TXT
- **Export Formats**: PDF, DOCX, TXT

### Data Retention

- Generated SOWs are stored indefinitely
- Uploaded files are stored indefinitely
- User login history is tracked (last login timestamp)
- Deleted items are permanently removed (no recycle bin)

### Browser Compatibility

Matcha-SOW is compatible with:
- Google Chrome (recommended)
- Mozilla Firefox
- Microsoft Edge
- Safari

For best experience, use the latest version of your browser.

### Security Features

- Password hashing with bcrypt
- Session-based authentication
- HTTP-only cookies
- Role-based access control
- File upload validation
- SQL injection protection

### API Integration

Matcha-SOW integrates with:
- **Matcha API**: AI-powered SOW generation
- **Azure AD**: Optional SSO authentication

---

## Glossary

- **SOW**: Statement of Work - A formal document that defines project deliverables, timelines, and scope
- **Knowledge Bank**: Repository of historical SOWs used for reference and analytics
- **Template**: Reference document used to guide AI SOW generation
- **Account**: Client organization in the system
- **Engagement Type**: Category of client engagement (e.g., Implementation, Advisory)
- **Master Data**: Core reference information (Accounts, Products, Engagement Types)
- **Resource Hours**: Time allocation by role for project work
- **Active Status**: Indicates whether a record is currently in use and visible
- **Export**: Process of downloading SOW in different file formats

---

## Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | November 2025 | Initial user guide creation |

---

**For additional support or questions, please contact your system administrator.**
