# 🤖 MMKeys Telegram Bot

This is a comprehensive Telegram Bot for selling and managing V2Ray/Xray keys automatically using the 3x-ui panel API. It supports multiple servers, premium subscriptions, and dynamic configuration.

---

## 🚀 Installation

### Option 1: Automatic Installation (Recommended)

We have prepared an automated script for easiest deployment on Ubuntu/Debian VPS.

1.  **Run Setup Script**:
    ```bash
    bash setup.sh
    ```
    This will install Node.js, Git, PM2, and guide you through the configuration.

2.  **Start the Bot**:
    After setup is complete, the bot will start automatically. You can verify with:
    ```bash
    pm2 status
    ```

### Option 2: Manual Installation

1.  **Install Node.js** (v16 or higher):
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ```

2.  **Clone Repository**:
    ```bash
    git clone <your-repo-url>
    cd mmkeys
    ```

3.  **Install Dependencies**:
    ```bash
    npm install
    ```

4.  **Configure Environment**:
    Create a `.env` file:
    ```bash
    nano .env
    ```
    Add the following (replace with your actual values):
    ```env
    TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
    ADMIN_ID=your_telegram_id
    MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

    # Static Configuration
    EXPIRE_DAYS=30
    LIMIT_GB_FREE=50
    LIMIT_GB_PREMIUM=0
    ```

5.  **Start the Bot**:
    ```bash
    npm start
    ```

6.  **Optional - Run with PM2** (for 24/7 operation):
    ```bash
    npm install -g pm2
    pm2 start src/index.js --name mmkeys
    pm2 startup
    pm2 save
    ```



## ⚙️ Configuration

### 1. Initial Config (.env)
During setup, you will be asked for:
*   `TELEGRAM_BOT_TOKEN`: Your bot token from @BotFather.
*   `ADMIN_ID`: Your numeric Telegram ID (get from @userinfobot).
*   `MONGO_URI`: MongoDB connection string (e.g., from MongoDB Atlas).
*   `PAYMENT_INFO`: Text displayed when users click "Buy Premium".

### 2. Dynamic Configuration (Admin Only)
You can change these settings directly from the bot without restarting:

*   **View Settings**: `/config`
*   **Set Force Subscribe Channel**:
    *   Command: `/set_channel @channelname`
    *   Disable: `/set_channel off`
    *   *Note: Ensure the bot is an Admin in that channel.*
*   **Set Anti-Spam Timer**:
    *   Command: `/set_ratelimit <ms>` (e.g., `/set_ratelimit 2000` for 2 seconds)
*   **Set Premium Price**:
    *   Command: `/set_price <text>` (e.g., `/set_price 5000 ks / month`)
*   **Set Payment Info**:
    *   Command: `/set_payment <text>` (supports \n for newlines)
    *   Example: `/set_payment KBZ: 09123456789\nWave: 09987654321`

---

## 🖥️ Server Management

The bot now manages servers via MongoDB. You can add, remove, or view servers directly from Telegram.

### 1. View Servers
Command: `/list_servers`
Displays ID, Name, URL, and Status of all active servers.

### 2. Add New Server
Use the `/add_server` command with a JSON object.

**Format**:
```json
/add_server {
  "id": "sg1",
  "name": "Singapore VIP",
  "url": "https://your-panel-url:2053",
  "username": "admin",
  "password": "password",
  "free": false
}
```
*   `id`: Unique identifier (e.g., `us1`, `sg1`).
*   `url`: Full URL including port and `https`.
*   `free`: Set to `true` if this server allows free keys.

### 3. Delete Server
Command: `/del_server <id>`
Example: `/del_server sg1`

---

## 🛠️ Admin Commands Reference

| Command | Description | Usage |
| :--- | :--- | :--- |
| **User Mgmt** | | |
| `/admin_user` | View user details (ID, Premium, Keys) | `/admin_user 123456789` |
| `/search_user` | Search user by Name or Username | `/search_user john` |
| `/add_premium` | Grant Premium status | `/add_premium 123456 30` (30 days) |
| `/remove_premium` | Revoke Premium status | `/remove_premium 123456` |
| `/ban` | Ban a user from the bot | `/ban 123456` |
| `/unban` | Unban a user | `/unban 123456` |
| **System** | | |
| `/server_status` | Check connection to all panels | `/server_status` |
| `/maintenance` | Turn Maintenance Mode On/Off | `/maintenance on` |
| `/broadcast` | Send message to ALL users | `/broadcast Hello Everyone!` |
| `/create_code` | Create a Gift Coupon for Premium | `/create_code 7 10` (7 Days, 10 Uses) |
| **Config** | | |
| `/config` | View current dynamic config | `/config` |
| `/set_channel` | Set force subscribe channel | `/set_channel @channelname` |
| `/set_price` | Update premium pricing | `/set_price 5000 ks/month` |
| `/set_payment` | Update payment instructions | `/set_payment KBZ: 09xxx` |
| `/list_servers` | List all servers | `/list_servers` |
| `/add_server` | Add new server | `/add_server {json}` |
| `/del_server` | Remove server | `/del_server sg1` |

---

## 📸 Payment Proof System

1.  User sends a **Photo** or **Text** to the bot (not a command).
2.  Bot forwards it to the Admin.
3.  **Admin Options**:
    *   **✅ Approve**: Instantly gives 30 Days Premium & notifies user.
    *   **❌ Reject**: Notifies user of rejection.
    *   **🚫 Ban**: Bans the user if spamming.

---

## 🆘 Troubleshooting

*   **Chat not found Error**: The bot must be an **Administrator** in the `REQUIRED_CHANNEL` to check membership.
*   **Mongo Connection Error**: Check your IP Whitelist on MongoDB Atlas.
*   **Timeout/Network Error**: If a server is slow, the bot might timeout. Use `/server_status` to check health.
*   **Bot Crash**: Use `pm2 logs mmkeys` to see the error.

---

**Developed for MMKeys**
