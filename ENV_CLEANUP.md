# .env Cleanup Guide

After the first bot startup, the following variables can be safely removed from `.env` because they are now managed in the MongoDB database:

## ✅ Can Remove (Now in Database)
- `REQUIRED_CHANNEL` - Managed via `/set_channel`
- `RATE_LIMIT_MS` - Managed via `/set_ratelimit`
- `PAYMENT_INFO` - Managed via `/set_payment`
- `PREMIUM_COST` - Managed via `/set_price`

## ⚠️ Must Keep (Required for Bot Operation)
- `TELEGRAM_BOT_TOKEN` - Bot authentication
- `ADMIN_ID` - Admin user ID
- `MONGO_URI` - Database connection

## 📌 Keep (Static Configuration)
- `EXPIRE_DAYS` - Free key expiration (default: 30)
- `LIMIT_GB_FREE` - Free user data limit in GB (default: 50)
- `LIMIT_GB_PREMIUM` - Premium user data limit, 0 = unlimited (default: 0)

## Minimal .env Example

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
ADMIN_ID=your_telegram_id
MONGO_URI=mongodb+srv://...

# Static Config (Optional - has defaults)
EXPIRE_DAYS=30
LIMIT_GB_FREE=50
LIMIT_GB_PREMIUM=0
```

## Migration Process

1. **First Run**: Bot will seed DB with current `.env` values
2. **Verify**: Use `/config` to check values are in DB
3. **Clean**: Remove dynamic config from `.env`
4. **Restart**: Bot will load from DB

---

**Note**: The first startup will automatically migrate your current `.env` settings to the database. After verification, you can clean up `.env` to only contain the required variables.
