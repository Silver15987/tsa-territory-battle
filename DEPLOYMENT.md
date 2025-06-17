# 🚀 Azure VM Deployment Guide

## **Quick Start (Recommended for Testing)**

### **1. Prepare Your Azure VM**
- Create an Ubuntu 20.04+ VM in Azure
- Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)
- Get your VM's public IP address

### **2. Build Your Application**
```bash
# On your local machine
cd client
npm run build

cd ../server
npm run build  # if you have a build script
```

### **3. Upload to Azure VM**
```bash
# Option A: Using SCP
scp -r . username@your-vm-ip:/home/username/generals-tsa

# Option B: Using Git
git clone your-repo-url /home/username/generals-tsa
```

### **4. Run Deployment Script**
```bash
# SSH into your VM
ssh username@your-vm-ip

# Make script executable and run
chmod +x deploy.sh
./deploy.sh
```

### **5. Configure Environment**
```bash
# Edit the environment file
nano /var/www/generals-tsa/.env

# Update these values:
DISCORD_CLIENT_ID=your_actual_discord_client_id
DISCORD_CLIENT_SECRET=your_actual_discord_client_secret
DISCORD_CALLBACK_URL=http://your-vm-ip/auth/discord/callback
FRONTEND_URL=http://your-vm-ip
```

### **6. Update Discord App Settings**
- Go to Discord Developer Portal
- Update OAuth2 Redirect URI to: `http://your-vm-ip/auth/discord/callback`

### **7. Restart Application**
```bash
pm2 restart generals-tsa
sudo systemctl reload nginx
```

---

## **🔧 Manual Setup (Alternative)**

### **Install Dependencies**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install Nginx
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Install PM2
sudo npm install -g pm2
```

### **Configure Application**
```bash
# Create app directory
sudo mkdir -p /var/www/generals-tsa
sudo chown $USER:$USER /var/www/generals-tsa

# Copy files
cp -r server/* /var/www/generals-tsa/
cp -r client/build /var/www/generals-tsa/public

# Install dependencies
cd /var/www/generals-tsa
npm install
```

### **Configure Nginx**
```bash
# Create Nginx config (see deploy.sh for full config)
sudo nano /etc/nginx/sites-available/generals-tsa

# Enable site
sudo ln -sf /etc/nginx/sites-available/generals-tsa /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### **Start Application**
```bash
cd /var/www/generals-tsa
pm2 start npm --name "generals-tsa" -- start
pm2 save
pm2 startup
```

---

## **🎮 Testing Your Deployment**

### **1. Test Basic Access**
```bash
# Test frontend
curl http://your-vm-ip

# Test backend
curl http://your-vm-ip/admin/grid
```

### **2. Test Discord Login**
- Visit: `http://your-vm-ip`
- Click "Login with Discord"
- Should redirect to Discord and back

### **3. Test AP Generation**
```bash
# Generate 2 AP for all users
curl -X POST http://your-vm-ip/admin/test-ap

# Generate 10 AP for all users
curl -X POST http://your-vm-ip/admin/test-ap/10
```

### **4. Test WebSocket Connection**
- Open browser console on the game page
- Should see WebSocket connection established

---

## **📊 Monitoring & Management**

### **Application Logs**
```bash
# View PM2 logs
pm2 logs generals-tsa

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# View Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

### **Application Management**
```bash
# Restart application
pm2 restart generals-tsa

# Stop application
pm2 stop generals-tsa

# Monitor resources
pm2 monit

# View status
pm2 status
```

### **System Monitoring**
```bash
# Check system resources
htop

# Check disk usage
df -h

# Check memory usage
free -h

# Check network connections
netstat -tulpn
```

---

## **🔒 Security Considerations**

### **Firewall Configuration**
```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable
```

### **SSL/HTTPS (Recommended for Production)**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### **Environment Security**
```bash
# Use strong session secrets
SESSION_SECRET=your-very-long-random-secret-key

# Use environment variables for sensitive data
# Never commit .env files to git
```

---

## **🚨 Troubleshooting**

### **Common Issues**

**1. Application won't start**
```bash
# Check logs
pm2 logs generals-tsa

# Check if port is in use
sudo netstat -tulpn | grep :4000

# Check environment file
cat /var/www/generals-tsa/.env
```

**2. Discord login fails**
- Verify Discord OAuth settings
- Check callback URL matches exactly
- Check environment variables

**3. WebSocket connection fails**
- Check Nginx WebSocket proxy configuration
- Verify Socket.IO is running on port 4000
- Check firewall settings

**4. Redis connection fails**
```bash
# Check Redis status
sudo systemctl status redis-server

# Test Redis connection
redis-cli ping
```

### **Performance Issues**
```bash
# Monitor CPU/Memory
htop

# Check for memory leaks
pm2 monit

# Restart if needed
pm2 restart generals-tsa
```

---

## **📈 Scaling Considerations**

### **For Multiple Users**
- Monitor Redis memory usage
- Consider Redis persistence
- Monitor WebSocket connections

### **For High Traffic**
- Use load balancer
- Consider Redis clustering
- Implement rate limiting
- Use CDN for static assets

---

## **🎯 Quick Commands Reference**

```bash
# Start everything
pm2 start generals-tsa
sudo systemctl start nginx
sudo systemctl start redis-server

# Stop everything
pm2 stop generals-tsa
sudo systemctl stop nginx
sudo systemctl stop redis-server

# Restart everything
pm2 restart generals-tsa
sudo systemctl reload nginx

# View status
pm2 status
sudo systemctl status nginx
sudo systemctl status redis-server

# Generate test AP
curl -X POST http://your-vm-ip/admin/test-ap/5
``` 