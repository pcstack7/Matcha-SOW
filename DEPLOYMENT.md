# AWS EC2 Ubuntu Deployment Guide

Complete step-by-step instructions for deploying the Matcha SOW application to an AWS EC2 Ubuntu instance.

## Prerequisites

- AWS Account with EC2 access
- SSH key pair for EC2 instance access
- Domain name (optional, for production)

## Step 1: Launch EC2 Instance

### 1.1 Create EC2 Instance

```bash
# From AWS Console:
# 1. Go to EC2 Dashboard
# 2. Click "Launch Instance"
# 3. Configure as follows:
```

**Instance Configuration:**
- **Name:** Matcha-SOW-Production
- **AMI:** Ubuntu Server 22.04 LTS (HVM), SSD Volume Type
- **Instance Type:** t2.small or t2.medium (minimum recommended)
- **Key Pair:** Select or create a new key pair
- **Network Settings:**
  - Allow SSH traffic from your IP
  - Allow HTTP traffic from the internet (port 80)
  - Allow HTTPS traffic from the internet (port 443)
  - Allow Custom TCP on port 3000 (for application)

### 1.2 Configure Security Group

```bash
# Add the following inbound rules:
Type            Protocol    Port Range    Source
SSH             TCP         22            Your IP/0.0.0.0/0
HTTP            TCP         80            0.0.0.0/0
HTTPS           TCP         443           0.0.0.0/0
Custom TCP      TCP         3000          0.0.0.0/0
```

## Step 2: Connect to EC2 Instance

```bash
# Download your .pem key file and set permissions
chmod 400 your-key.pem

# Connect to your instance
ssh -i your-key.pem ubuntu@<your-ec2-public-ip>
```

## Step 3: Install Required Software

### 3.1 Update System

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y
```

### 3.2 Install Node.js

```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 3.3 Install Git

```bash
# Install Git
sudo apt install -y git

# Verify installation
git --version
```

### 3.4 Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -y pm2 -g

# Verify installation
pm2 --version
```

### 3.5 Install Nginx (Optional - for reverse proxy)

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify installation
sudo systemctl status nginx
```

## Step 4: Clone and Setup Application

### 4.1 Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone the repository (replace with your actual repo URL)
git clone https://github.com/pcstack7/Matcha-SOW.git

# Navigate into project directory
cd Matcha-SOW

# Checkout the correct branch
git checkout claude/api-config-frontend-011CUbBkxSSh1N3X5WxWGC4r
```

### 4.2 Install Dependencies

```bash
# Install Node.js dependencies
npm install

# This may take a few minutes
```

### 4.3 Build the Frontend

```bash
# Build the React frontend
npm run build

# Verify build completed successfully
ls -la public/
```

## Step 5: Configure Environment Variables

### 5.1 Create .env File

```bash
# Create .env file
nano .env
```

### 5.2 Add Configuration

```env
# Paste the following (replace with your actual values)
MATCHA_API_KEY=your_actual_api_key_here
WORKSPACE_ID=2010
MISSION_ID=7618
BASE_URL=https://matcha.harriscomputer.com/rest/api/v1
PORT=3000
NODE_ENV=production
```

Save and exit (Ctrl+X, then Y, then Enter).

### 5.3 Secure the .env File

```bash
# Restrict permissions
chmod 600 .env

# Verify permissions
ls -la .env
```

## Step 6: Database Migration

### 6.1 Initialize Database

The database will be automatically initialized when the server starts for the first time.

```bash
# Create uploads directory
mkdir -p uploads/templates

# Set proper permissions
chmod 755 uploads
chmod 755 uploads/templates
```

### 6.2 Migration from Existing Database (if applicable)

If you have an existing database:

```bash
# Stop the application (if running)
pm2 stop matcha-sow

# Backup existing database
cp sow.db sow.db.backup

# Copy new database (if migrating from another server)
scp -i your-key.pem /path/to/old/sow.db ubuntu@<ec2-ip>:~/Matcha-SOW/

# The migration function will automatically run when server starts
# It will rename 'company' column to 'account_contact'
# It will rename 'address' column to 'notes'
```

### 6.3 Manual Migration (if needed)

If automatic migration fails:

```bash
# Install sqlite3
sudo apt install -y sqlite3

# Open database
sqlite3 sow.db

# Run migration commands
ALTER TABLE accounts RENAME COLUMN company TO account_contact;
ALTER TABLE accounts RENAME COLUMN address TO notes;

# Exit sqlite3
.exit
```

## Step 7: Start Application with PM2

### 7.1 Start the Server

```bash
# Start application with PM2
pm2 start server.js --name matcha-sow

# View logs
pm2 logs matcha-sow

# Check status
pm2 status
```

### 7.2 Configure PM2 Startup

```bash
# Generate startup script
pm2 startup

# Copy and run the command provided by PM2 (it will look like):
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Save PM2 process list
pm2 save

# Verify
pm2 list
```

## Step 8: Configure Nginx Reverse Proxy (Recommended)

### 8.1 Create Nginx Configuration

```bash
# Create new site configuration
sudo nano /etc/nginx/sites-available/matcha-sow
```

### 8.2 Add Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Or your EC2 public IP

    # Increase upload size for template uploads
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Save and exit.

### 8.3 Enable Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/matcha-sow /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Step 9: Configure SSL with Let's Encrypt (Production)

### 9.1 Install Certbot

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### 9.2 Obtain SSL Certificate

```bash
# Get certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts:
# - Enter email address
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (option 2)
```

### 9.3 Auto-renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot will automatically renew certificates
```

## Step 10: Firewall Configuration

### 10.1 Configure UFW (Ubuntu Firewall)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow Nginx
sudo ufw allow 'Nginx Full'

# If not using Nginx, allow port 3000
sudo ufw allow 3000/tcp

# Check status
sudo ufw status
```

## Step 11: Monitoring and Maintenance

### 11.1 View Application Logs

```bash
# View real-time logs
pm2 logs matcha-sow

# View last 100 lines
pm2 logs matcha-sow --lines 100

# Clear logs
pm2 flush
```

### 11.2 Application Management

```bash
# Restart application
pm2 restart matcha-sow

# Stop application
pm2 stop matcha-sow

# Delete from PM2
pm2 delete matcha-sow

# Monitor resources
pm2 monit
```

### 11.3 Update Application

```bash
# Pull latest changes
cd ~/Matcha-SOW
git pull origin claude/api-config-frontend-011CUbBkxSSh1N3X5WxWGC4r

# Install new dependencies (if any)
npm install

# Rebuild frontend
npm run build

# Restart application
pm2 restart matcha-sow
```

### 11.4 Database Backup

```bash
# Create backup script
nano ~/backup-db.sh
```

Add the following:

```bash
#!/bin/bash
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
cp ~/Matcha-SOW/sow.db $BACKUP_DIR/sow_$TIMESTAMP.db
# Keep only last 7 days of backups
find $BACKUP_DIR -name "sow_*.db" -mtime +7 -delete
echo "Database backed up to $BACKUP_DIR/sow_$TIMESTAMP.db"
```

Make executable:

```bash
chmod +x ~/backup-db.sh
```

Add to crontab:

```bash
# Edit crontab
crontab -e

# Add this line (backup daily at 2 AM)
0 2 * * * /home/ubuntu/backup-db.sh
```

## Step 12: Testing the Deployment

### 12.1 Test Application

```bash
# From your local machine, test the deployment

# Test HTTP connection
curl http://<your-ec2-ip>:3000

# Or with domain
curl http://your-domain.com

# Test API endpoint
curl http://<your-ec2-ip>:3000/api/accounts
```

### 12.2 Test in Browser

1. Open browser and navigate to:
   - Direct: `http://<your-ec2-ip>:3000`
   - With Nginx: `http://your-domain.com`
   - With SSL: `https://your-domain.com`

2. Test all features:
   - Create an account
   - Upload a template
   - Generate a SOW
   - Export to PDF, DOCX, TXT

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs matcha-sow --err

# Check if port 3000 is in use
sudo netstat -tlnp | grep 3000

# Check environment variables
cat .env

# Restart application
pm2 restart matcha-sow
```

### Database Errors

```bash
# Check database file exists
ls -la ~/Matcha-SOW/sow.db

# Check permissions
chmod 644 ~/Matcha-SOW/sow.db

# View database structure
sqlite3 ~/Matcha-SOW/sow.db ".schema"
```

### Nginx Errors

```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check Nginx SSL configuration
sudo nano /etc/nginx/sites-available/matcha-sow
```

## Performance Optimization

### 12.1 Enable Gzip Compression

Edit Nginx config:

```bash
sudo nano /etc/nginx/nginx.conf
```

Uncomment or add:

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript
           application/json application/javascript application/xml+rss;
```

### 12.2 Increase PM2 Instances (for better performance)

```bash
# Use cluster mode
pm2 delete matcha-sow
pm2 start server.js -i 2 --name matcha-sow
pm2 save
```

## Security Checklist

- [ ] Changed default SSH port (optional)
- [ ] Disabled root login
- [ ] Configured UFW firewall
- [ ] Installed fail2ban (optional)
- [ ] Set up SSL certificates
- [ ] Secured .env file (chmod 600)
- [ ] Configured automated backups
- [ ] Set up monitoring/alerting
- [ ] Restricted database permissions
- [ ] Reviewed Nginx security headers

## Support

For issues:
- Check application logs: `pm2 logs matcha-sow`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Check system logs: `sudo journalctl -xe`

## Summary

Your Matcha SOW application is now deployed on AWS EC2 Ubuntu! Access it at:
- **Direct Access:** `http://<your-ec2-ip>:3000`
- **With Nginx:** `http://your-domain.com`
- **With SSL:** `https://your-domain.com`

The application includes:
- Account management with contact and notes fields
- Template management (PDF, DOCX, TXT)
- AI-powered SOW generation
- Export functionality with proper Verdana formatting
- Automatic database migrations
- Production-ready deployment with PM2 and Nginx
