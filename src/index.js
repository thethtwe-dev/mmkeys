require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const db = require('./db');
const serverManager = require('./serverManager');
const messages = require('./messages');

// Configuration
const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = parseInt(process.env.ADMIN_ID);
// Limits
const gbToBytes = (gb) => Math.floor(gb * 1024 * 1024 * 1024);
const limitGbFree = parseFloat(process.env.LIMIT_GB_FREE) || 1;
const limitGbPremium = parseFloat(process.env.LIMIT_GB_PREMIUM) || 0; // 0 = Unlimited

console.log(`Loaded ADMIN_ID: ${adminId}`);

const freeExpireDays = parseInt(process.env.EXPIRE_DAYS) || 30;

// Spam Protection Config
const rateLimitMs = parseInt(process.env.RATE_LIMIT_MS) || 2000;
const requiredChannel = process.env.REQUIRED_CHANNEL ? process.env.REQUIRED_CHANNEL.replace('@', '') : null; // Remove @ if user added it

// Rate Limit Map
const userLastMessage = new Map();

// Garbage Collection: Remove old entries every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [userId, lastTime] of userLastMessage.entries()) {
        if (now - lastTime > rateLimitMs) {
            userLastMessage.delete(userId);
        }
    }
}, 5 * 60 * 1000);

if (!token) {
    console.error('Missing TELEGRAM_BOT_TOKEN. Please check .env file.');
    process.exit(1);
}

const bot = new Telegraf(token);

// Helper for Localization
const t = (lang, key, params = {}) => {
    const validLang = (lang && messages[lang]) ? lang : 'my'; // Default: Myanmar
    let text = messages[validLang][key] || messages['en'][key] || key;

    // Replace placeholders {key}
    for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`{${k}}`, 'g'), v);
    }
    return text;
};

// --- Cron Job: Daily Report (8:00 AM) ---
cron.schedule('0 8 * * *', async () => {
    try {
        const stats = await db.getStats();
        // Maybe check server status too?
        let serverStatus = "✅ All Systems Normal";
        // Simple ping check
        const servers = serverManager.getServers();
        let offlineCount = 0;
        for (const s of servers) {
            const api = serverManager.getApi(s.id);
            try {
                await api.getAllInbounds(); // Test call
            } catch (e) {
                offlineCount++;
            }
        }
        if (offlineCount > 0) serverStatus = `⚠️ ${offlineCount} Servers Offline`;

        const msg = `📊 *Daily Report*\n\n` +
            `Users: ${stats.users}\n` +
            `Premium: ${stats.premium}\n` +
            `Keys: ${stats.keys}\n` +
            `Status: ${serverStatus}`;

        await bot.telegram.sendMessage(adminId, msg, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error("Daily Report Error:", e);
    }
});

// Middleware: Maintenance Check & User DB
bot.use(async (ctx, next) => {
    if (ctx.from) {
        // Maintenance Check (Skip for Admin)
        const maintenance = await db.getConfig('maintenance');
        if (maintenance && ctx.from.id !== adminId) {
            return ctx.reply("🚧 Bot is currently under maintenance. Please try again later.\n\n bot ပြုပြင်မွမ်းမံနေပါသဖြင့် ခေတ္တစောင့်ဆိုင်းပေးပါ။");
        }

        console.log(`Received update from: ${ctx.from.id}, Type: ${ctx.updateType}`);

        // 1. Create/Update User in DB (Upsert)
        const { id, first_name, username } = ctx.from;
        await db.upsertUser(id, first_name, username);

        const userId = id;
        const user = await db.getUser(userId);
        const lang = user ? user.language : 'my';
        const isUserAdmin = (userId === adminId);

        // 0. Banned Check (Skip for Admin)
        if (!isUserAdmin && user && user.banned) {
            return ctx.reply(t(lang, 'banned'));
        }

        // 2. Rate Limiting Check (Skip for Admin)
        if (!isUserAdmin) {
            const now = Date.now();
            const lastTime = userLastMessage.get(userId) || 0;
            if (now - lastTime < rateLimitMs) {
                // Silent Drop for strict spam protection.
                return;
            }
            userLastMessage.set(userId, now);
        }

        // 3. Force Subscribe Check (Skip for Admin or if Channel not set)
        if (requiredChannel && !isUserAdmin) {
            // Only check for Message updates (commands, text) or CallbackQueries
            if (ctx.message || ctx.callbackQuery) {
                try {
                    const chatMember = await ctx.telegram.getChatMember(`@${requiredChannel}`, userId);
                    // Status: creator, administrator, member, restricted
                    const validStatus = ['creator', 'administrator', 'member', 'restricted'];
                    if (!validStatus.includes(chatMember.status)) {
                        // Not a member
                        const channelLink = `https://t.me/${requiredChannel}`;
                        // If callback, answer it
                        if (ctx.callbackQuery) await ctx.answerCbQuery(t(lang, 'join_channel'), { show_alert: true });

                        // Reply with Join Button
                        await ctx.reply(t(lang, 'join_channel'), Markup.inlineKeyboard([
                            [Markup.button.url(t(lang, 'join_btn'), channelLink)]
                        ]));
                        return; // Stop processing
                    }
                } catch (err) {
                    console.error("Force Subscribe Check Error:", err.message);
                }
            }
        }
    }
    return next();
});

// --- Commands ---

const premiumCost = process.env.PREMIUM_COST || "$5 / month";
const paymentInfo = (process.env.PAYMENT_INFO || "Contact Admin").replace(/\\n/g, '\n');

// Helper to Send Main Menu
const sendMainMenu = async (ctx, lang) => {
    const keyboard = Markup.keyboard([
        [t(lang, 'menu_gen'), t(lang, 'menu_mykey')],
        [t(lang, 'menu_status'), t(lang, 'menu_premium')],
        [t(lang, 'menu_lang')]
    ]).resize();

    await ctx.reply(t(lang, 'welcome'), keyboard);
};

bot.start(async (ctx) => {
    const user = await db.getUser(ctx.from.id);
    const lang = user ? user.language : 'my';
    await sendMainMenu(ctx, lang);
});

bot.command(['language', 'lang'], (ctx) => {
    ctx.reply("🏳️ Select Language / ဘာသာစကားရွေးပါ:", Markup.inlineKeyboard([
        [Markup.button.callback("🇬🇧 English", "set_lang:en")],
        [Markup.button.callback("🇲🇲 Myanmar", "set_lang:my")]
    ]));
});

bot.action(/^set_lang:(.+)$/, async (ctx) => {
    const lang = ctx.match[1];
    await db.setLanguage(ctx.from.id, lang);
    await ctx.answerCbQuery(lang === 'my' ? "Language set to Myanmar" : "Language set to English");

    const msg = lang === 'my' ? "✅ မြန်မာဘာသာစကား သတ်မှတ်လိုက်ပါပြီ!" : "✅ Language set to English!";

    // Reply with confirmation then show menu
    await ctx.reply(msg);
    await sendMainMenu(ctx, lang);

    // Optional: Delete the language selection menu
    ctx.deleteMessage().catch(() => { });
});

// --- Command Logic Handlers ---

const handleGen = async (ctx) => {
    const userId = ctx.from.id;
    try {
        const user = await db.getUser(userId);
        const lang = user ? user.language : 'my';
        const isPremium = user.is_premium === 1;

        // 1. Check Limits (If Free)
        if (!isPremium) {
            const lastClaim = user.free_key_last_claim ? new Date(user.free_key_last_claim) : null;
            if (lastClaim) {
                const now = new Date();
                const diffTime = Math.abs(now - lastClaim);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 30) {
                    return ctx.reply(t(lang, 'limit_reached'));
                }
            }
        }

        // 2. Server Selection
        const servers = serverManager.getServers(!isPremium); // Filter if free

        if (servers.length === 0) {
            return ctx.reply(t(lang, 'server_unavailable'));
        }

        const buttons = servers.map(s => [Markup.button.callback(s.name, `server:${s.id}`)]);
        ctx.reply(t(lang, 'select_server'), Markup.inlineKeyboard(buttons));

    } catch (error) {
        console.error("Error in /gen:", error);
        ctx.reply("❌ Error occurred.");
    }
};

const handleMyKey = async (ctx) => {
    const userId = ctx.from.id;
    try {
        const user = await db.getUser(userId);
        const lang = user ? user.language : 'my';

        const keys = await db.getKeys(userId);
        if (keys.length === 0) return ctx.reply(t(lang, 'no_active_keys'));

        for (const key of keys) {
            const api = serverManager.getApi(key.server_id);
            if (api) {
                const server = serverManager.getServer(key.server_id);
                const remark = server ? `${server.name} ( mmkeys_bot )` : "";

                const link = await api.generateLink(key.inbound_id, key.uuid, key.email, remark);
                if (link) ctx.replyWithMarkdown(t(lang, 'mykey_list', { server: key.server_id, email: key.email, link }));
            }
        }
    } catch (error) {
        console.error(error);
        ctx.reply("Error retrieving keys.");
    }
};

// Helper to format bytes
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const handleStatus = async (ctx) => {
    const userId = ctx.from.id;

    try {
        const user = await db.getUser(userId);
        const lang = user ? user.language : 'my';

        if (!user) {
            return ctx.reply(t(lang, 'no_active_keys'));
        }

        ctx.sendChatAction('typing');

        // Find active key
        const keys = await db.getKeys(userId);
        if (keys.length === 0) {
            return ctx.reply(t(lang, 'no_active_keys'));
        }

        // Use the most recent key (Single Key Policy matches this)
        const key = keys[0];
        const api = serverManager.getApi(key.server_id);

        if (!api) {
            return ctx.reply(t(lang, 'server_unavailable'));
        }

        const stats = await api.getClientStats(key.email);

        if (stats) {
            const up = formatBytes(stats.up);
            const down = formatBytes(stats.down);
            const total = formatBytes(stats.total);
            const expiry = stats.expiryTime > 0 ? new Date(stats.expiryTime).toLocaleDateString() : t(lang, 'never');

            const isPremium = user.is_premium === 1;
            const accountType = isPremium ? t(lang, 'premium_plan') : t(lang, 'free_plan');
            const subExpiry = isPremium && user.premium_expiry ? new Date(user.premium_expiry).toLocaleDateString() : (isPremium ? t(lang, 'unlimited') : t(lang, 'not_applicable'));

            let message = t(lang, 'account_status') + "\n" +
                accountType + "\n" +
                (isPremium ? t(lang, 'plan_expiry', { date: subExpiry }) + "\n" : "") +
                "-------------------\n" +
                t(lang, 'usage_server', { server: key.server_id }) + "\n" +
                t(lang, 'usage_upload', { up }) + "\n" +
                t(lang, 'usage_download', { down }) + "\n" +
                t(lang, 'usage_total', { total: formatBytes(stats.up + stats.down) }) + "\n" +
                t(lang, 'usage_limit', { limit: total }) + "\n" +
                t(lang, 'key_expiry', { date: expiry });

            // Add Upgrade Button if user is FREE
            if (!isPremium) {
                ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
                    Markup.button.callback(t(lang, 'upgrade_btn'), "upgrade_info")
                ]));
            } else {
                ctx.replyWithMarkdown(message);
            }

        } else {
            ctx.reply(t(lang, 'stats_unavailable'));
        }

    } catch (error) {
        console.error("Error in /status:", error);
        ctx.reply("❌ An internal error occurred.");
    }
};

bot.command('gen', handleGen);

// Handle Server Selection -> Show Inbounds (Protocols)
bot.action(/^server:(.+)$/, async (ctx) => {
    const serverId = ctx.match[1];
    const userId = ctx.from.id;

    try {
        const user = await db.getUser(userId);
        const lang = user ? user.language : 'my';

        const api = serverManager.getApi(serverId);
        if (!api) return ctx.reply(t(lang, 'server_unavailable'));

        await ctx.answerCbQuery(t(lang, 'fetching_protocols'));

        // We only show inbounds valid for user generation (usually standard VLESS/VMESS ports)
        // For MVP, show all.
        const inbounds = await api.getAllInbounds();

        if (!inbounds || inbounds.length === 0) {
            return ctx.reply(t(lang, 'no_protocols'));
        }

        const buttons = inbounds.map(i => {
            let label = `${i.remark} (${i.protocol.toUpperCase()})`;
            return [Markup.button.callback(label, `proto:${serverId}:${i.id}`)];
        });

        ctx.editMessageText(t(lang, 'select_protocol', { server: serverId }), Markup.inlineKeyboard(buttons));

    } catch (error) {
        console.error("Error fetching inbounds:", error);
        ctx.reply("❌ Failed to fetch protocols.");
    }
});

// Handle Protocol Selection -> Generate Key
bot.action(/^proto:(.+):(\d+)$/, async (ctx) => {
    const serverId = ctx.match[1];
    const inboundId = parseInt(ctx.match[2]);
    const userId = ctx.from.id;

    try {
        const user = await db.getUser(userId);
        const lang = user ? user.language : 'my';
        const isPremium = user.is_premium === 1;

        if (!isPremium) {
            const lastClaim = user.free_key_last_claim ? new Date(user.free_key_last_claim) : null;
            if (lastClaim) {
                const now = new Date();
                const diffDays = Math.ceil(Math.abs(now - lastClaim) / (1000 * 60 * 60 * 24));
                if (diffDays < 30) return ctx.reply(t(lang, 'limit_reached'));
            }
        }

        await ctx.answerCbQuery(t(lang, 'generating'));
        ctx.editMessageText(t(lang, 'generating'));

        // --- Single Key Policy: Delete Old Keys ---
        const existingKeys = await db.getKeys(userId);
        if (existingKeys.length > 0) {
            for (const key of existingKeys) {
                try {
                    const oldApi = serverManager.getApi(key.server_id);
                    if (oldApi) {
                        await oldApi.deleteClient(key.inbound_id, key.uuid);
                    }
                    await db.deleteKey(key.uuid);
                } catch (delErr) {
                    console.error(`Failed to delete old key for user ${userId}:`, delErr);
                }
            }
        }

        const api = serverManager.getApi(serverId);
        const email = `tg_${userId}_${Math.floor(Math.random() * 10000)}`;

        let limit = 0;
        if (isPremium) {
            limit = limitGbPremium > 0 ? gbToBytes(limitGbPremium) : 0;
        } else {
            limit = gbToBytes(limitGbFree);
        }

        // Expiry: If free, set panel expiry. If premium, maybe set panel expiry or handle externally.
        // For now: Free = 30 days panel expiry. Premium = 0 (Unlimited time on panel, but bot manages user sub).
        const expire = isPremium ? 0 : freeExpireDays;

        const result = await api.addClient(inboundId, email, limit, expire);

        if (result.success) {
            // Save Key
            await db.addKey(result.uuid, userId, email, inboundId, serverId);

            // Generate Link
            const server = serverManager.getServer(serverId);
            const remark = server ? `${server.name} ( mmkeys_bot )` : "";

            const link = await api.generateLink(inboundId, result.uuid, email, remark);

            // Update User Limit logic
            if (!isPremium) {
                await db.updateFreeClaim(userId);
            }

            ctx.replyWithMarkdown(t(lang, 'key_generated', { link }));
        } else {
            ctx.reply(t(lang, 'key_gen_fail', { msg: result.msg }));
        }

    } catch (error) {
        console.error("Error generating key:", error);
        ctx.reply("❌ Error generating key.");
    }
});

bot.command('mykey', handleMyKey);

bot.command('status', handleStatus);

// --- Admin Dashboard & Tools ---

const isAdmin = (ctx) => {
    const userId = ctx.from.id;
    const isMatch = userId === adminId;
    console.log(`Admin Check: User ${userId} vs Admin ${adminId} -> ${isMatch}`);
    return isMatch;
};

bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx)) return;

    const stats = await db.getStats();
    let msg = `🛠️ *Admin Dashboard*\n\n`;
    msg += `👥 Total Users: ${stats.users}\n`;
    msg += `💎 Premium Users: ${stats.premium}\n`;
    msg += `🔑 Active Keys: ${stats.keys}\n\n`;
    msg += `*Commands:*\n`;
    msg += `\`/admin_user\` <id> - Check User\n`;
    msg += `\`/add_premium\` <id> <days> - Give Premium\n`;
    msg += `\`/remove_premium\` <id> - Remove Premium\n`;
    msg += `\`/broadcast\` <msg> - Send to all\n`;
    msg += `\`/ban\` <id> - Ban User\n`;
    msg += `\`/unban\` <id> - Unban User\n`;
    msg += `\`/search_user\` <name> - Find User\n`;
    msg += `\`/create_code\` <days> <count> - Gift Code\n`;
    msg += `\`/maintenance\` <on/off> - Maintenance\n`;
    msg += `\`/server_status\` - Check Servers`;

    ctx.replyWithMarkdown(msg);
});

bot.command('create_code', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const args = ctx.message.text.split(' ');
    // /create_code 30 5 (30 days, 5 uses)
    const days = parseInt(args[1]);
    const maxUses = parseInt(args[2]) || 1;

    if (!days) return ctx.reply("Usage: /create_code <days> [max_uses]");

    // Generate simple readable code
    const code = 'GIFT-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const result = await db.createCoupon(code, days, maxUses);
    if (result.success) {
        ctx.reply(`🎁 Coupon Created!\nCode: \`${code}\`\nDays: ${days}\nUses: ${maxUses}`);
    } else {
        ctx.reply(`❌ Failed: ${result.msg}`);
    }
});

bot.command('redeem', async (ctx) => {
    const code = ctx.message.text.split(' ')[1];
    if (!code) return ctx.reply("Usage: /redeem <code>");

    const result = await db.redeemCoupon(ctx.from.id, code);
    if (result.success) {
        const days = result.days;
        const expiryDate = new Date();
        // Calculate new expiry (add to current expiry if already premium?) 
        // For simplicity, just add to today or extend if already premium
        const user = await db.getUser(ctx.from.id);
        const currentExpiry = (user.is_premium && user.premium_expiry > new Date()) ? new Date(user.premium_expiry) : new Date();
        currentExpiry.setDate(currentExpiry.getDate() + days);

        await db.setPremium(ctx.from.id, true, currentExpiry.toISOString());
        ctx.reply(`✅ Success! You received ${days} Days Premium.\nNew Expiry: ${currentExpiry.toLocaleDateString()}`);
    } else {
        ctx.reply(`❌ ${result.msg}`);
    }
});

bot.command('maintenance', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const arg = ctx.message.text.split(' ')[1]; // on or off
    if (!arg) return ctx.reply("Usage: /maintenance <on/off>");

    if (arg === 'on') {
        await db.setConfig('maintenance', true);
        ctx.reply("🚧 Maintenance Mode ENABLED.");
    } else if (arg === 'off') {
        await db.setConfig('maintenance', false);
        ctx.reply("🟢 Maintenance Mode DISABLED.");
    } else {
        ctx.reply("Use 'on' or 'off'.");
    }
});

bot.command('server_status', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const servers = serverManager.getServers();
    let msg = "🖥️ *Server Status*\n\n";

    ctx.reply("Checking servers...");

    for (const s of servers) {
        const api = serverManager.getApi(s.id);
        const start = Date.now();
        try {
            await api.getAllInbounds(); // Ping
            const ping = Date.now() - start;
            msg += `✅ ${s.name}: Online (${ping}ms)\n`;
        } catch (e) {
            msg += `❌ ${s.name}: Offline\n`;
        }
    }
    ctx.replyWithMarkdown(msg);
});

bot.command('admin_user', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const args = ctx.message.text.split(' ');
    const targetId = parseInt(args[1]);

    if (!targetId) return ctx.reply("Usage: /admin_user <id>");

    const user = await db.getUser(targetId);
    if (!user) return ctx.reply("User not found.");

    const keys = await db.getKeys(targetId);
    let info = `👤 *User Info*\nID: \`${user.tg_id}\`\nLanguage: ${user.language}\nPremium: ${user.is_premium ? 'Yes' : 'No'}\n`;
    if (user.is_premium) info += `Expiry: ${user.premium_expiry}\n`;
    info += `Keys: ${keys.length}`;

    ctx.replyWithMarkdown(info);
});

bot.command('add_premium', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const args = ctx.message.text.split(' ');
    const targetId = parseInt(args[1]);
    const days = parseInt(args[2]);

    if (!targetId || !days) return ctx.reply("Usage: /add_premium <id> <days>");

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    await db.setPremium(targetId, true, expiryDate.toISOString());
    ctx.reply(`✅ Premium added to ${targetId} for ${days} days.`);

    // Notify User
    try {
        const user = await db.getUser(targetId);
        const lang = user ? user.language : 'my';
        bot.telegram.sendMessage(targetId, t(lang, 'admin_approved'));
    } catch (e) { }
});

bot.command('remove_premium', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const args = ctx.message.text.split(' ');
    const targetId = parseInt(args[1]);

    if (!targetId) return ctx.reply("Usage: /remove_premium <id>");

    await db.downgradeUser(targetId);
    ctx.reply(`✅ Premium removed from ${targetId}.`);

    try {
        const user = await db.getUser(targetId);
        const lang = user ? user.language : 'my';
        bot.telegram.sendMessage(targetId, t(lang, 'downgraded'));
    } catch (e) { }
});

bot.command('broadcast', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const message = ctx.message.text.split(' ').slice(1).join(' ');
    if (!message) return ctx.reply("Usage: /broadcast <message>");

    const users = await db.getAllUsers();
    ctx.reply(`📢 Sending broadcast to ${users.length} users...`);

    let successCount = 0;
    let failCount = 0;
    const batchSize = 25; // Telegram Limit ~30 req/sec

    for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        await Promise.all(batch.map(async (u) => {
            try {
                await bot.telegram.sendMessage(u.tg_id, `📢 *Announcement*\n\n${message}`, { parse_mode: 'Markdown' });
                successCount++;
            } catch (e) {
                failCount++; // User blocked bot or other error
            }
        }));

        // Small delay between batches to be safe
        if (i + batchSize < users.length) await new Promise(r => setTimeout(r, 1000));
    }

    ctx.reply(`✅ Broadcast completed.\nSuccess: ${successCount}\nFailed: ${failCount}`);
});

bot.command('ban', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const args = ctx.message.text.split(' ');
    const targetId = parseInt(args[1]);
    if (!targetId) return ctx.reply("Usage: /ban <id>");

    await db.banUser(targetId);
    ctx.reply(`🚫 User ${targetId} has been BANNED.`);
});

bot.command('unban', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const args = ctx.message.text.split(' ');
    const targetId = parseInt(args[1]);
    if (!targetId) return ctx.reply("Usage: /unban <id>");

    await db.unbanUser(targetId);
    ctx.reply(`✅ User ${targetId} has been UNBANNED.`);
});

bot.command('search_user', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const query = ctx.message.text.split(' ').slice(1).join(' ');
    if (!query) return ctx.reply("Usage: /search_user <name or username>");

    const users = await db.searchUsers(query);
    if (users.length === 0) return ctx.reply("❌ No users found.");

    let msg = `🔍 *Found Users (${users.length}):*\n`;
    users.forEach(u => {
        let status = u.is_premium ? '💎' : '👤';
        status += u.banned ? ' 🚫' : '';
        const name = u.first_name || 'N/A';
        const username = u.username ? `@${u.username}` : '';
        msg += `${status} \`${u.tg_id}\` - ${name} ${username}\n`;
    });
    ctx.replyWithMarkdown(msg);
});

// --- Premium & Admin Flow ---

const sendPremiumInfo = async (ctx) => {
    const user = await db.getUser(ctx.from.id);
    const lang = user ? user.language : 'my';

    const info = t(lang, 'premium_info', { price: premiumCost, payment: paymentInfo });

    ctx.replyWithMarkdown(info, Markup.inlineKeyboard([
        Markup.button.callback(t(lang, 'submit_proof_btn'), "submit_proof")
    ]));
};

bot.command('premium', sendPremiumInfo);

// Also handle the "upgrade_info" callback to show the same menu
bot.action("upgrade_info", sendPremiumInfo);

// Proof Submission (Ask for photo/text)
// For MVP, just tell them to send a photo now.
bot.action("submit_proof", async (ctx) => {
    const user = await db.getUser(ctx.from.id);
    const lang = user ? user.language : 'my';
    ctx.reply(t(lang, 'send_proof'));
});

// --- Menu Handlers ---

// Match both English and Myanmar button text (or keywords)
bot.hears(['🔑 Generate Key', '🔑 Key ထုတ်မယ်'], (ctx) => handleGen(ctx));

bot.hears(['📁 My Keys', '📁 Key စစ်မယ်'], (ctx) => handleMyKey(ctx));
bot.hears(['📊 Account Status', '📊 အကောင့် Status'], (ctx) => handleStatus(ctx));
bot.hears(['💎 Upgrade Premium', '💎 Premium ဝယ်မယ်'], (ctx) => sendPremiumInfo(ctx));
bot.hears(['🏳️ Language'], (ctx) => {
    ctx.reply("🏳️ Select Language / ဘာသာစကားရွေးပါ:", Markup.inlineKeyboard([
        [Markup.button.callback("🇬🇧 English", "set_lang:en")],
        [Markup.button.callback("🇲🇲 Myanmar", "set_lang:my")]
    ]));
});

// Handle Photos/Text for Proof
bot.on(['photo', 'text'], async (ctx) => {
    // Ignore commands (starts with /)
    if (ctx.message.text && ctx.message.text.startsWith('/')) return;

    const isSelfTest = (ctx.from.id === adminId);

    // If not admin and not user, or if checking specifically...
    if (!adminId) return;

    // Fetch sender user to get their lang? No, here we reply to sender, so yes.
    const user = await db.getUser(ctx.from.id);
    const lang = user ? user.language : 'my';

    // Prepare content
    const name = user ? user.first_name : 'N/A';
    const username = user && user.username ? `@${user.username}` : 'No Username';
    // HTML link format
    const userLink = `<a href="tg://user?id=${ctx.from.id}">${name}</a>`;

    // Detailed Caption (HTML)
    const caption = `📩 <b>New Payment Proof</b>\n\n` +
        `👤 User: ${userLink}\n` +
        `🆔 ID: <code>${ctx.from.id}</code>\n` +
        `📛 Username: ${username}\n` +
        `📅 Date: ${new Date().toLocaleString()}\n` +
        `Check: /admin_user ${ctx.from.id}`;

    const buttons = Markup.inlineKeyboard([
        [
            Markup.button.callback("✅ Approve (1 Month)", `approve:${ctx.from.id}:30`),
            Markup.button.callback("❌ Reject", `reject:${ctx.from.id}`)
        ],
        [
            Markup.button.callback("🚫 Ban User", `ban:${ctx.from.id}`)
        ]
    ]);

    // If it's the Admin testing on themselves, just reply with the admin panel directly
    const targetChatId = isSelfTest ? ctx.from.id : adminId;
    const notificationText = isSelfTest ? t(lang, 'self_test_forwarding') : t(lang, 'proof_received');

    try {
        if (ctx.message.photo) {
            await bot.telegram.sendPhoto(targetChatId, ctx.message.photo[ctx.message.photo.length - 1].file_id, {
                caption: caption,
                parse_mode: 'HTML',
                ...buttons
            });
            ctx.reply(notificationText);
        } else if (ctx.message.text) {
            await bot.telegram.sendMessage(targetChatId, `📄 <b>Text Proof</b>\n${caption}\n\nMessage:\n${ctx.message.text}`, {
                parse_mode: 'HTML',
                ...buttons
            });
            ctx.reply(notificationText);
        }
    } catch (e) {
        console.error("Error forwarding proof:", e);
        ctx.reply("❌ Error submitting proof.");
    }
});

// Admin Actions
bot.action(/^ban:(\d+)$/, async (ctx) => {
    const targetUserId = parseInt(ctx.match[1]);
    try {
        await db.banUser(targetUserId);
        ctx.reply(`🚫 User ${targetUserId} BANNED.`);
        // Notify admin in the original message
        const originalText = ctx.callbackQuery.message.caption || ctx.callbackQuery.message.text;
        const newText = `${originalText}\n\n🚫 *USER BANNED*`;

        if (ctx.callbackQuery.message.caption) {
            await ctx.editMessageCaption(newText, { parse_mode: 'Markdown' });
        } else {
            await ctx.editMessageText(newText, { parse_mode: 'Markdown' });
        }
    } catch (e) {
        console.error(e);
        ctx.reply("Error banning user.");
    }
});

bot.action(/^approve:(\d+):(\d+)$/, async (ctx) => {
    const targetUserId = parseInt(ctx.match[1]);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // Hardcoded 30 days for now

    try {
        await db.setPremium(targetUserId, true, expiryDate.toISOString());

        // Fetch user to get lang for notification
        const user = await db.getUser(targetUserId);
        const lang = user ? user.language : 'my';

        await bot.telegram.sendMessage(targetUserId, t(lang, 'admin_approved'));

        const originalText = ctx.callbackQuery.message.caption || ctx.callbackQuery.message.text;
        const newText = `${originalText}\n\n✅ *APPROVED*`;

        if (ctx.callbackQuery.message.caption) {
            await ctx.editMessageCaption(newText, { parse_mode: 'Markdown' });
        } else {
            await ctx.editMessageText(newText, { parse_mode: 'Markdown' });
        }
    } catch (e) {
        console.error(e);
        ctx.reply("Error approving user.");
    }
});

bot.action(/^reject:(\d+)$/, async (ctx) => {
    const targetUserId = parseInt(ctx.match[1]);
    try {
        // Fetch user to get lang for notification
        const user = await db.getUser(targetUserId);
        const lang = user ? user.language : 'my';

        await bot.telegram.sendMessage(targetUserId, t(lang, 'admin_rejected'));

        const originalText = ctx.callbackQuery.message.caption || ctx.callbackQuery.message.text;
        const newText = `${originalText}\n\n❌ *REJECTED*`;

        if (ctx.callbackQuery.message.caption) {
            await ctx.editMessageCaption(newText, { parse_mode: 'Markdown' });
        } else {
            await ctx.editMessageText(newText, { parse_mode: 'Markdown' });
        }
    } catch (e) {
        console.error(e);
        ctx.reply("Error rejecting user.");
    }
});


// Cleanup Job (Run every hour)
setInterval(async () => {
    try {
        const expiredUsers = await db.getExpiredPremiumUsers();
        for (const user of expiredUsers) {
            const keys = await db.getKeys(user.tg_id);
            for (const key of keys) {
                const api = serverManager.getApi(key.server_id);
                if (api) {
                    await api.deleteClient(key.inbound_id, key.uuid);
                }
                await db.deleteKey(key.uuid);
            }
            await db.downgradeUser(user.tg_id);
            try {
                const lang = user.language || 'my';
                await bot.telegram.sendMessage(user.tg_id, t(lang, 'downgraded'));
            } catch (err) {
                // User might have blocked bot
            }
            console.log(`Downgraded user ${user.tg_id}`);
        }
    } catch (e) {
        console.error("Cleanup error:", e);
    }
}, 3600 * 1000); // 1 hour

bot.launch().then(() => {
    console.log('MMKeys Bot is running (Multi-Server Refactor)...');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
