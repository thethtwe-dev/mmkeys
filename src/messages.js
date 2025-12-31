const messages = {
    en: {
        welcome: "Welcome to MM Keys Bot! 🚀",
        select_server: "🌍 *Select a Server Location:*",
        server_unavailable: "❌ Server not available.",
        fetching_protocols: "Fetching protocols...",
        no_protocols: "❌ No protocols found.",
        select_protocol: "📍 *Server Selected: {server}*\nSelect Protocol:",
        generating: "Generating Key... ⏳",
        limit_reached: "⚠️ Limit reached. Free users: 1 key / month.",
        key_generated: "✅ *Key Generated Successfully!* \n\n`{link}`",
        key_gen_fail: "❌ Failed to generate key: {msg}",
        no_active_keys: "You have no active keys. Use /gen to create one.",
        mykey_list: "🔑 *{server} - {email}*\n`{link}`",
        account_status: "📊 *Account Status*",
        free_plan: "👤 *Free Plan*",
        premium_plan: "💎 *Premium Plan*",
        plan_expiry: "📅 *Plan Expiry:* {date}",
        usage_server: "🌍 *Server:* {server}",
        usage_upload: "⬆️ *Upload:* {up}",
        usage_download: "⬇️ *Download:* {down}",
        usage_total: "📦 *Total Used:* {total}",
        usage_limit: "🛑 *Limit:* {limit}",
        key_expiry: "⏳ *Key Expiry:* {date}",
        upgrade_btn: "💎 Upgrade to Premium",
        premium_info: "💎 *Premium Upgrade*\n\nUnlock all servers and unlimited data!\nPrice: {price}\n\nPlease transfer to: \n{payment}\n\nAfter transfer, click below to submit proof.",
        submit_proof_btn: "📤 Submit Payment Proof",
        send_proof: "Please send a screenshot of the transaction or the Transaction ID now.",
        proof_received: "✅ Proof received. Admin will verify shortly.",
        admin_approved: "🎉 *Your Premium Upgrade is Approved!* \n\nYou can now use /gen to create unlimited keys on all servers.",
        admin_rejected: "❌ Your payment proof was rejected. Please contact admin.",
        downgraded: "⚠️ Your Premium subscription has expired. Your keys have been removed. Use /premium to renew.",
        lang_select: "🏳️ Select Language / ဘာသာစကားရွေးပါ:",
        lang_set: "✅ Language set to English!",

        // Menu Buttons
        menu_gen: "🔑 Generate Key",
        menu_mykey: "📁 My Keys",
        menu_status: "📊 Account Status",
        menu_premium: "💎 Upgrade Premium",
        menu_lang: "🏳️ Language",

        // Spam Protection
        join_channel: "⚠️ Please join our channel to use this bot.\n\nAfter joining, click /start again.",
        join_btn: "📢 Join Channel",
        rate_limit: "⚠️ Too fast! Please wait a moment.",
        banned: "🚫 Your account has been banned."
    },
    my: {
        welcome: "မင်္ဂလာပါ! V2Ray Key များကို အလွယ်တကူ ထုတ်ယူနိုင်ပါတယ်။\nစတင်ရန် အောက်ပါ Menu ကို အသုံးပြုပါ။ 👇",
        limit_reached: "⚠️ သင့်ရဲ့ Free Key ထုတ်ယူခွင့် ပြည့်သွားပါပြီ။ နောက်လမှ ပြန်လာပါ သို့မဟုတ် Premium ဝယ်ယူပါ။",
        server_unavailable: "❌ Server မရရှိနိုင်သေးပါ။ ခေတ္တစောင့်ပါ။",
        select_server: "🌍 Server ရွေးချယ်ပါ:",
        fetching_protocols: "📡 protocol များကို ရှာဖွေနေပါသည်...",
        no_protocols: "❌ ဤ Server တွင် Protocol မရှိပါ။",
        select_protocol: "🔌 {server} အတွက် Protocol ရွေးပါ:",
        generating: "⚙️ Key ထုတ်လုပ်နေပါသည်...",
        key_generated: "✅ *Key ထုတ်လုပ်ပြီးပါပြီ!*\n\n`{link}`\n\n(Copy ကူးပြီး V2Ray App တွင် ထည့်သွင်းပါ)",
        key_gen_fail: "❌ Key ထုတ်မရပါ: {msg}",
        no_active_keys: "❌ သင့်တွင် Active Key မရှိပါ။",
        mykey_list: "🔑 *Server:* {server}\n📧 *Email:* `{email}`\n🔗 *Link:* `{link}`",

        // Status
        account_status: "👤 *အကောင့်အခြေအနေ*",
        free_plan: "Free Plan (1 Key / Month)",
        premium_plan: "Premium Plan 💎",
        unlimited: "အကန့်အသတ်မရှိ (Unlimited)",
        not_applicable: "N/A",
        plan_expiry: "📅 Plan သက်တမ်း: {date}",
        usage_server: "🌍 Server: {server}",
        usage_upload: "⬆️ Upload: {up}",
        usage_download: "⬇️ Download: {down}",
        usage_total: "📦 Total: {total}",
        usage_limit: "📊 Data Limit: {limit}",
        key_expiry: "⏳ Key သက်တမ်း: {date}",
        never: "Never",
        stats_unavailable: "❌ အချက်အလက် မရရှိနိုင်ပါ။ Server ကို စစ်ဆေးပါ။",

        // Premium
        upgrade_btn: "💎 Premium ဝယ်မယ်",
        premium_info: "💎 *Premium Plan Features*\n\n✅ Unlimited Keys Generation\n✅ Unlimited Speed & Data (Fair Use)\n✅ Priority Support\n\n💰 *စျေးနှုန်း:* {price}\n\n💸 *ငွေလွှဲရန်:* {payment}\n\nငွေလွှဲပြီးပါက Screenshot ပို့ပေးပါ။ 👇",
        submit_proof_btn: "📸 ငွေလွှဲပြေစာ ပို့မယ်",
        send_proof: "📸 ငွေလွှဲ Screenshot (သို့) Transaction ID ကို ပို့ပေးပါ။ Admin မှ စစ်ဆေးပြီး Approve လုပ်ပေးပါမည်။",
        proof_received: "✅ လက်ခံရရှိပါသည်။ Admin မှ စစ်ဆေးနေပါသည်။",
        admin_approved: "🎉 *Congratulations!* သင့်အကောင့်ကို Premium အဆင့်သို့ မြှင့်တင်လိုက်ပါပြီ။ Unlimited Key ထုတ်နိုင်ပါပြီ!",
        admin_rejected: "❌ *Sorry!* သင့်ငွေလွှဲမှု အချက်အလက် မမှန်ကန်ပါ (သို့) မပြည့်စုံပါ။ Admin ကို ဆက်သွယ်ပါ။",
        downgraded: "⚠️ Premium သက်တမ်းကုန်ဆုံးသွားပါပြီ။ Free Plan သို့ ပြောင်းလဲလိုက်ပါသည်။",
        self_test_forwarding: "🔄 (Self-Test) Admin ထံ Forward လုပ်လိုက်ပြီ။",

        // Menu Buttons
        menu_gen: "🔑 Key ထုတ်မယ်",
        menu_mykey: "📁 Key စစ်မယ်",
        menu_status: "📊 အကောင့် Status",
        menu_premium: "💎 Premium ဝယ်မယ်",
        menu_lang: "🏳️ Language",

        // Spam Protection
        join_channel: "⚠️ Bot ကိုအသုံးပြုရန် Channel ကို Join ဖို့လိုအပ်ပါတယ်။\n\nJoin ပြီးလျှင် /start ကို နှိပ်ပါ။",
        join_btn: "📢 Channel Join မယ်",
        rate_limit: "⚠️ မြန်လွန်းနေသည်! ခေတ္တစောင့်ပါ။",
        banned: "🚫 Your account has been banned. | သင့်အကောင့်ကို ပိတ်ပင်ထားပါသည်။"
    }
};

module.exports = messages;
