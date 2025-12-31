const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('❌ MONGO_URI is missing in .env');
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    }
};

connectDB();

// --- Schemas ---

const userSchema = new mongoose.Schema({
    tg_id: { type: Number, required: true, unique: true, index: true },
    first_name: String,
    username: String,
    language: { type: String, default: 'my' },
    is_premium: { type: Number, default: 0 }, // 0 or 1
    premium_expiry: Date,
    free_key_last_claim: Date,
    banned: { type: Number, default: 0 }, // 0 or 1
    inbound_id: Number,
    created_at: { type: Date, default: Date.now }
});

const keySchema = new mongoose.Schema({
    uuid: { type: String, required: true, unique: true, index: true },
    tg_id: { type: Number, required: true, index: true }, // Not a reference for simplicity, just ID
    email: String,
    inbound_id: Number,
    server_id: String,
    created_at: { type: Date, default: Date.now }
});

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, index: true },
    days: { type: Number, required: true },
    max_uses: { type: Number, default: 1 },
    used_count: { type: Number, default: 0 },
    used_by: [Number], // Array of tg_ids
    created_at: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed
});

const User = mongoose.model('User', userSchema);
const Key = mongoose.model('Key', keySchema);
const Coupon = mongoose.model('Coupon', couponSchema);
const Config = mongoose.model('Config', configSchema);

// --- User Management ---

const upsertUser = async (tgId, firstName, username) => {
    try {
        await User.findOneAndUpdate(
            { tg_id: tgId },
            {
                tg_id: tgId,
                first_name: firstName,
                username: username
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    } catch (err) {
        console.error('upsertUser Error:', err);
    }
};

const getUser = async (tgId) => {
    try {
        const user = await User.findOne({ tg_id: tgId }).lean();
        return user;
    } catch (err) {
        console.error('getUser Error:', err);
        return null;
    }
};

const searchUsers = async (query) => {
    try {
        const regex = new RegExp(query, 'i');
        const users = await User.find({
            $or: [
                { first_name: regex },
                { username: regex }
            ]
        }).limit(10).lean();
        return users;
    } catch (err) {
        console.error('searchUsers Error:', err);
        return [];
    }
};

const setPremium = async (tgId, isPremium, expiryDate) => {
    try {
        await User.updateOne(
            { tg_id: tgId },
            { is_premium: isPremium ? 1 : 0, premium_expiry: expiryDate }
        );
    } catch (err) {
        console.error('setPremium Error:', err);
    }
};

const updateFreeClaim = async (tgId) => {
    try {
        await User.updateOne(
            { tg_id: tgId },
            { free_key_last_claim: new Date() }
        );
    } catch (err) {
        console.error('updateFreeClaim Error:', err);
    }
};

const getExpiredPremiumUsers = async () => {
    try {
        const users = await User.find({
            is_premium: 1,
            premium_expiry: { $lt: new Date() }
        }).select('tg_id').lean();
        return users;
    } catch (err) {
        console.error('getExpiredPremiumUsers Error:', err);
        return [];
    }
};

const downgradeUser = async (tgId) => {
    try {
        await User.updateOne(
            { tg_id: tgId },
            { is_premium: 0, premium_expiry: null }
        );
    } catch (err) {
        console.error('downgradeUser Error:', err);
    }
};

const setLanguage = async (tgId, lang) => {
    try {
        await User.updateOne(
            { tg_id: tgId },
            { language: lang }
        );
    } catch (err) {
        console.error('setLanguage Error:', err);
    }
};

const banUser = async (tgId) => {
    try {
        await User.updateOne(
            { tg_id: tgId },
            { banned: 1 }
        );
    } catch (err) {
        console.error('banUser Error:', err);
    }
};

const unbanUser = async (tgId) => {
    try {
        await User.updateOne(
            { tg_id: tgId },
            { banned: 0 }
        );
    } catch (err) {
        console.error('unbanUser Error:', err);
    }
};

// --- Key Management ---

const getKeys = async (tgId) => {
    try {
        const keys = await Key.find({ tg_id: tgId }).lean();
        return keys;
    } catch (err) {
        console.error('getKeys Error:', err);
        return [];
    }
};

const addKey = async (uuid, tgId, email, inboundId, serverId) => {
    try {
        await Key.create({
            uuid,
            tg_id: tgId,
            email,
            inbound_id: inboundId,
            server_id: serverId
        });
    } catch (err) {
        console.error('addKey Error:', err);
    }
};

const deleteKey = async (uuid) => {
    try {
        await Key.deleteOne({ uuid: uuid });
    } catch (err) {
        console.error('deleteKey Error:', err);
    }
};

const getAllUsers = async () => {
    try {
        const users = await User.find({}).select('tg_id').lean();
        return users;
    } catch (err) {
        console.error('getAllUsers Error:', err);
        return [];
    }
};

const getStats = async () => {
    try {
        const userCount = await User.countDocuments({});
        const premiumCount = await User.countDocuments({ is_premium: 1 });
        const keyCount = await Key.countDocuments({});

        return {
            users: userCount,
            premium: premiumCount,
            keys: keyCount
        };
    } catch (err) {
        console.error('getStats Error:', err);
        return { users: 0, premium: 0, keys: 0 };
    }
};

// --- Coupon Management ---

const createCoupon = async (code, days, maxUses) => {
    try {
        await Coupon.create({ code, days, max_uses: maxUses });
        return { success: true };
    } catch (err) {
        console.error('createCoupon Error:', err);
        if (err.code === 11000) return { success: false, msg: 'Code already exists' };
        return { success: false, msg: err.message };
    }
};

const redeemCoupon = async (tgId, code) => {
    // Start session if replica set, but standard insert/update is simpler for single node.
    // Mongoose transactional logic is complex without replica set config in Atlas Free Tier sometimes.
    // We will use atomic updates.
    try {
        const coupon = await Coupon.findOne({ code: code });
        if (!coupon) return { success: false, msg: 'Invalid code' };
        if (coupon.used_count >= coupon.max_uses) return { success: false, msg: 'Code fully redeemed' };
        if (coupon.used_by.includes(tgId)) return { success: false, msg: 'You already redeemed this code' };

        // Atomic update
        const res = await Coupon.updateOne(
            { code: code, used_count: { $lt: coupon.max_uses }, used_by: { $ne: tgId } },
            {
                $inc: { used_count: 1 },
                $push: { used_by: tgId }
            }
        );

        if (res.modifiedCount === 0) {
            return { success: false, msg: 'Redemption failed (Limit reached or already used)' };
        }

        return { success: true, days: coupon.days };
    } catch (err) {
        console.error('redeemCoupon Error:', err);
        return { success: false, msg: 'Error redeeming code' };
    }
};

// --- Config Management ---

const getConfig = async (key) => {
    try {
        const conf = await Config.findOne({ key });
        return conf ? conf.value : null;
    } catch (err) {
        console.error('getConfig Error:', err);
        return null;
    }
};

const setConfig = async (key, value) => {
    try {
        await Config.updateOne({ key }, { value }, { upsert: true });
    } catch (err) {
        console.error('setConfig Error:', err);
    }
};

// Ensure createUser is compatible (maps to upsertUser for now, or simple insert)
// index.js calls: await db.createUser(ctx.from.id);
// We can just query if exists, if not create. But upsertUser is called in middleware too.
// Let's alias createUser to a simple existence check or no-op since upsertUser expects name.
// Actually, index.js calls `createUser(id)` in middleware initially, and `upsertUser` in the new middleware.
// Let's make createUser safe.
const createUser = async (tgId) => {
    try {
        const exists = await User.exists({ tg_id: tgId });
        if (!exists) {
            await User.create({ tg_id: tgId });
        }
    } catch (err) {
        // Ignore duplicate key error just in case
        if (err.code !== 11000) console.error('createUser Error:', err);
    }
};

module.exports = {
    getUser,
    createUser,
    upsertUser,
    searchUsers,
    setPremium,
    updateFreeClaim,
    getExpiredPremiumUsers,
    downgradeUser,
    getKeys,
    addKey,
    deleteKey,
    setLanguage,
    getAllUsers,
    getStats,
    banUser,
    unbanUser,
    createCoupon,
    redeemCoupon,
    getConfig,
    setConfig
};
