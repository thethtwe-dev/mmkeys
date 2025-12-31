const axios = require('axios');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const agent = new https.Agent({
    rejectUnauthorized: false
});

axios.defaults.httpsAgent = agent;

class PanelApi {
    constructor(baseUrl, username, password) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.username = username;
        this.password = password;
        this.cookie = null;
    }

    async login() {
        try {
            const url = `${this.baseUrl}/login`;
            console.log(`Attempting login to: ${url}`);
            try {
                const response = await axios.post(url, {
                    username: this.username,
                    password: this.password
                });

                if (response.data.success) {
                    // Extract session cookie
                    const cookies = response.headers['set-cookie'];
                    if (cookies && cookies.length > 0) {
                        // Try to find 'session' or '3x-ui' or just take the first one that looks like a session
                        // User log shows: 3x-ui=...
                        this.cookie = cookies.find(c => c.startsWith('session=') || c.startsWith('3x-ui=')) || cookies[0];

                        // Ensure we just get the name=value part for the header
                        if (this.cookie) {
                            this.cookie = this.cookie.split(';')[0];
                        }

                        console.log(`Login successful. Cookie: ${this.cookie}`);
                        return true;
                    } else {
                        console.error('Login success but no cookie returned.');
                    }
                }
                console.error('Login failed:', response.data);
                return false;
            } catch (error) {
                console.error('Login error:', error.message);
                return false;
            }
        } catch (e) {
            console.error('Login unexpected error:', e);
            return false;
        }
    }

    async addClient(inboundId, email, limitBytes, expireDays) {
        if (!this.cookie) {
            const loginSuccess = await this.login();
            if (!loginSuccess) {
                return { success: false, msg: "Login failed. Check URL and credentials." };
            }
        }

        const uuid = uuidv4();
        let password = uuid;

        // Fetch Inbound to check for Shadowsocks 2022 requirements
        try {
            const inbound = await this.getInbound(inboundId);
            if (inbound && inbound.protocol === 'shadowsocks') {
                const settings = JSON.parse(inbound.settings || '{}');
                const method = settings.method || '';
                if (method.includes('2022')) {
                    // Generate proper base64 key: 16 bytes for 128-bit, 32 bytes for 256-bit
                    const len = method.includes('128') ? 16 : 32;
                    password = crypto.randomBytes(len).toString('base64');
                }
            }
        } catch (e) {
            console.error("Auto-detect SS version failed, using default UUID", e);
        }

        // Calculate expiry timestamp (ms)
        const expiryTime = expireDays ? Date.now() + (expireDays * 24 * 60 * 60 * 1000) : 0;

        const clientData = {
            id: inboundId,
            settings: JSON.stringify({
                clients: [{
                    id: uuid,
                    password: password, // Updated for SS-2022 or UUID
                    email: email,
                    limitIp: 1, // Limit to 1 IP
                    totalGB: limitBytes,
                    expiryTime: expiryTime,
                    enable: true,
                    tgId: "",
                    subId: ""
                }]
            })
        };

        // List of possible endpoints for different panel versions
        const endpoints = [
            '/panel/api/inbounds/addClient', // MHSanaei (Standard)
            '/xui/API/inbounds/addClient',   // FranzKafkaYu / Alireza
            '/panel/inbounds/addClient',      // Some other forks
            '/xui/inbound/addClient'         // Original X-UI
        ];

        for (const endpoint of endpoints) {
            try {
                const url = `${this.baseUrl}${endpoint}`;
                console.log(`Trying to add client at: ${url}`);

                const response = await axios.post(url, clientData, {
                    headers: {
                        'Cookie': this.cookie,
                        'Content-Type': 'application/json',
                        'Referer': `${this.baseUrl}/panel/inbounds`,
                        'Origin': this.baseUrl
                    }
                });

                if (response.data.success) {
                    return { success: true, uuid: uuid, email: email };
                } else if (response.data.msg) {
                    // If we get a response but it says failed (e.g. duplicate email), return it
                    return { success: false, msg: response.data.msg };
                }

                // If success is false but no message, might be wrong endpoint returning 200 OK HTML?
                // Continue to next endpoint if it looks suspicious, or just return fail.
                // Usually X-UI returns JSON.

            } catch (error) {
                // If 404, try next endpoint
                if (error.response && error.response.status === 404) {
                    console.log(`Endpoint ${endpoint} not found (404). Trying next...`);
                    continue;
                }

                // If 401, try re-login once (only for the first attempt)
                if (error.response && error.response.status === 401 && endpoint === endpoints[0]) {
                    console.log("Session expired, retrying login...");
                    await this.login();
                    // Recursive retry is risky here with the loop, so just break and let user try again 
                    // OR reset cookie and recurse ONCE. 
                    // Simpler: return error.
                    return { success: false, error: "Session expired. Please try again." };
                }

                console.error(`Error at ${endpoint}:`, error.message);
                // If other error (500 etc), stop trying
                return { success: false, error: error.message };
            }
        }

        return { success: false, error: "All API endpoints failed (404). Check Panel Version." };
    }

    async deleteClient(inboundId, clientUuid) {
        if (!this.cookie) await this.login();

        // Common Endpoints for Deletion
        // 1. POST /panel/api/inbounds/delClient/:inboundId/:clientUuid
        // 2. POST /xui/inbound/delClient/:inboundId/:clientUuid

        // Attempt 1: Path based (MHSanaei / X-UI)
        const pathEndpoints = [
            `/panel/api/inbounds/delClient/${inboundId}/${clientUuid}`,
            `/xui/API/inbounds/delClient/${inboundId}/${clientUuid}`,
            `/panel/inbound/delClient/${inboundId}/${clientUuid}`
        ];

        for (const endpoint of pathEndpoints) {
            try {
                const url = `${this.baseUrl}${endpoint}`;
                const response = await axios.post(url, {}, {
                    headers: { 'Cookie': this.cookie }
                });
                if (response.data.success) return true;
            } catch (e) {
                // ignore
            }
        }
        return false;
    }

    // Get all inbounds to list for admin
    async getAllInbounds() {
        if (!this.cookie) await this.login();

        const endpoints = [
            '/panel/api/inbounds/list',
            '/xui/API/inbounds/list',
            '/panel/inbounds/list',
            '/xui/inbound/list'
        ];

        for (const endpoint of endpoints) {
            try {
                const url = `${this.baseUrl}${endpoint}`;
                const response = await axios.get(url, {
                    headers: {
                        'Cookie': this.cookie,
                        'Referer': `${this.baseUrl}/panel/inbounds`,
                        'Origin': this.baseUrl
                    }
                });

                if (response.data.success) {
                    return response.data.obj;
                }
            } catch (error) {
                if (error.response && error.response.status === 404) continue;
                console.error(`Error listing inbounds at ${endpoint}:`, error.message);
            }
        }
        return [];
    }

    // Get client stats by email
    async getClientStats(email) {
        const inbounds = await this.getAllInbounds();
        for (const inbound of inbounds) {
            if (inbound.clientStats) {
                const client = inbound.clientStats.find(c => c.email === email);
                if (client) {
                    return {
                        up: client.up,
                        down: client.down,
                        total: client.total,
                        expiryTime: client.expiryTime,
                        enable: client.enable
                    };
                }
            }
        }
        return null;
    }

    // Helper to get inbound details via list (more reliable than get/id)
    async getInbound(inboundId) {
        if (!this.cookie) await this.login();

        const endpoints = [
            '/panel/api/inbounds/list',
            '/xui/API/inbounds/list',
            '/panel/inbounds/list',
            '/xui/inbound/list'
        ];

        for (const endpoint of endpoints) {
            try {
                const url = `${this.baseUrl}${endpoint}`;
                // List is usually GET
                const response = await axios.get(url, {
                    headers: {
                        'Cookie': this.cookie,
                        'Referer': `${this.baseUrl}/panel/inbounds`,
                        'Origin': this.baseUrl
                    }
                });

                if (response.data.success) {
                    const inbounds = response.data.obj;
                    return inbounds.find(i => i.id == inboundId || i.port == inboundId); // Support matching by ID or Port
                }
            } catch (error) {
                if (error.response && error.response.status === 404) continue;
                console.error(`Error listing inbounds at ${endpoint}:`, error.message);
            }
        }
        return null;
    }

    // Basic vmess link constructor (simplified, might need robust generator based on stream settings)
    async generateLink(inboundId, uuid, email, remark = "") {
        const inbound = await this.getInbound(inboundId);
        if (!inbound) return null;

        const streamSettings = JSON.parse(inbound.streamSettings);
        const protocol = inbound.protocol;

        // This is a simplified link generator. 
        // Real implementation depends on complex stream settings (ws, tcp, tls, etc.)
        // For now, assume common setup: VMESS + WS + TLS or VLESS + REALITY

        let link = "";
        const port = inbound.port;
        // Host needs to be extracted from panel URL or configured separately if behind CDN
        // For now using panel hostname
        const host = new URL(this.baseUrl).hostname;

        const name = remark || email;

        if (protocol === 'vmess') {
            const vmessConfig = {
                v: "2",
                ps: name,
                add: host,
                port: port,
                id: uuid,
                aid: "0",
                scy: "auto",
                net: streamSettings.network,
                type: "none",
                host: "",
                path: streamSettings.wsSettings?.path || "/",
                tls: streamSettings.security === "tls" ? "tls" : ""
            };
            link = "vmess://" + Buffer.from(JSON.stringify(vmessConfig)).toString('base64');
        } else if (protocol === 'vless') {
            // VLESS://uuid@host:port?param=value#name
            const query = [];
            query.push(`type=${streamSettings.network}`);
            if (streamSettings.security === 'tls') query.push('security=tls');
            if (streamSettings.security === 'reality') {
                query.push('security=reality');
                query.push(`pbk=${streamSettings.realitySettings?.publicKey}`);
                query.push(`fp=${streamSettings.realitySettings?.fingerprint}`);
                query.push(`sni=${streamSettings.realitySettings?.serverNames?.[0]}`);
            }
            if (streamSettings.network === 'ws') {
                query.push(`path=${encodeURIComponent(streamSettings.wsSettings?.path || "/")}`);
            }

            link = `vless://${uuid}@${host}:${port}?${query.join('&')}#${encodeURIComponent(name)}`;
        } else if (protocol === 'shadowsocks') {
            // SS Link: ss://base64(method:password)@host:port#tag
            const client = inbound.clientStats ? inbound.clientStats.find(c => c.email === email) : null;
            const settings = JSON.parse(inbound.settings);
            const clientSettings = settings.clients.find(c => c.email === email);

            if (clientSettings) {
                const method = settings.method;
                const password = clientSettings.password || uuid;
                const userInfo = Buffer.from(`${method}:${password}`).toString('base64');
                link = `ss://${userInfo}@${host}:${port}#${encodeURIComponent(name)}`;
            }
        }

        return link;
    }
}

module.exports = PanelApi;
