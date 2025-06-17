#!/bin/bash

# Azure VM Deployment Script for Generals TSA
# This script sets up the game server on an Azure VM

echo "🚀 Starting Generals TSA deployment on Azure VM..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis
echo "📦 Installing Redis..."
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install Nginx
echo "📦 Installing Nginx..."
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Install PM2 for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Create application directory
echo "📁 Setting up application directory..."
sudo mkdir -p /var/www/generals-tsa
sudo chown $USER:$USER /var/www/generals-tsa

# Copy application files (assuming you're running this from the project root)
echo "📋 Copying application files..."
cp -r server/* /var/www/generals-tsa/
cp -r client/build /var/www/generals-tsa/public

# Install dependencies
echo "📦 Installing server dependencies..."
cd /var/www/generals-tsa
npm install

# Create environment file
echo "🔧 Creating environment configuration..."
cat > .env << EOF
# Server Configuration
PORT=4000
NODE_ENV=production

# Redis Configuration
REDIS_URL=redis://localhost:6379

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/generals-tsa

# Discord OAuth Configuration
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_CALLBACK_URL=http://your-vm-ip/auth/discord/callback

# Session Configuration
SESSION_SECRET=your-super-secret-session-key

# Frontend URL
FRONTEND_URL=http://your-vm-ip
EOF

# Configure Nginx
echo "🔧 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/generals-tsa << EOF
server {
    listen 80;
    server_name your-vm-ip;

    # Serve static files (React build)
    location / {
        root /var/www/generals-tsa/public;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Proxy API requests to Node.js server
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Proxy WebSocket connections
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Proxy auth endpoints
    location /auth/ {
        proxy_pass http://localhost:4000/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Proxy admin endpoints
    location /admin/ {
        proxy_pass http://localhost:4000/admin/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/generals-tsa /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (if you add SSL later)
sudo ufw --force enable

# Start the application with PM2
echo "🚀 Starting application with PM2..."
pm2 start npm --name "generals-tsa" -- start
pm2 save
pm2 startup

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update the .env file with your Discord OAuth credentials"
echo "2. Replace 'your-vm-ip' in the Nginx config with your actual VM IP"
echo "3. Test the application: http://your-vm-ip"
echo "4. Monitor logs: pm2 logs generals-tsa"
echo "5. Restart if needed: pm2 restart generals-tsa"
echo ""
echo "🔧 Useful commands:"
echo "- View logs: pm2 logs generals-tsa"
echo "- Restart app: pm2 restart generals-tsa"
echo "- Stop app: pm2 stop generals-tsa"
echo "- Monitor: pm2 monit"
echo "- Nginx logs: sudo tail -f /var/log/nginx/access.log" 