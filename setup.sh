#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=================================${NC}"
echo -e "${GREEN}   MMKeys Bot VPS Setup Script   ${NC}"
echo -e "${GREEN}=================================${NC}"

# 1. Update & Install System Dependencies
echo -e "${YELLOW}[1/5] Updating System...${NC}"
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nano

# 2. Install Node.js 20 (LTS)
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[2/5] Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo -e "${GREEN}Node.js is already installed.${NC}"
fi

# 3. Install Project Dependencies
echo -e "${YELLOW}[3/5] Installing NPM Dependencies...${NC}"
npm install

# 4. Setup .env File
echo -e "${YELLOW}[4/5] Checking Configuration...${NC}"

if [ ! -f .env ]; then
    echo -e "${YELLOW}.env file not found!${NC}"
    echo -e "${YELLOW}Creating minimal .env template...${NC}"
    cat > .env << 'EOF'
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
ADMIN_ID=your_telegram_id
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Static Configuration
EXPIRE_DAYS=30
LIMIT_GB_FREE=50
LIMIT_GB_PREMIUM=0
EOF
    echo -e "${GREEN}.env template created. Opening editor...${NC}"
    read -p "Press Enter to edit .env file (Replace values, Save with Ctrl+O, Enter, Exit with Ctrl+X)..."
    nano .env
else
    echo -e "${GREEN}.env file exists.${NC}"
fi

# 5. Setup PM2
echo -e "${YELLOW}[5/5] Setting up PM2 Process Manager...${NC}"
sudo npm install -g pm2

# Stop existing if running
pm2 stop mmkeys 2>/dev/null
pm2 delete mmkeys 2>/dev/null

# Start Bot
pm2 start src/index.js --name "mmkeys"
pm2 save

# Setup Startup Script
echo -e "${YELLOW}Configuring PM2 Startup...${NC}"
pm2 startup | tail -n 1 > temp_startup.sh
chmod +x temp_startup.sh
./temp_startup.sh
rm temp_startup.sh

echo -e "${GREEN}=================================${NC}"
echo -e "${GREEN}   Setup Complete! Bot Running   ${NC}"
echo -e "${GREEN}=================================${NC}"
echo -e ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Add your first server with: ${GREEN}/add_server <json>${NC}"
echo -e "  2. Configure settings with: ${GREEN}/config${NC}"
echo -e ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo -e "  Stop Bot:    ${GREEN}pm2 stop mmkeys${NC}"
echo -e "  Restart Bot: ${GREEN}pm2 restart mmkeys${NC}"
echo -e "  View Logs:   ${GREEN}pm2 logs mmkeys${NC}"
