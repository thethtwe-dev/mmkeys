const fs = require('fs');
const path = require('path');
const PanelApi = require('./api');
const db = require('./db');

const serversPath = path.resolve(__dirname, '../config/servers.json');

class ServerManager {
    constructor() {
        this.servers = [];
        this.apis = new Map(); // Map<serverId, PanelApi>
    }

    async loadServers() {
        try {
            console.log('🔄 Loading Servers from DB...');
            let servers = await db.getAllServers();

            // Migration: If no servers in DB, load from JSON and populate DB
            if (servers.length === 0 && fs.existsSync(serversPath)) {
                console.log('⚠️ No servers in DB. Migrating from servers.json...');
                const data = fs.readFileSync(serversPath, 'utf8');
                const jsonServers = JSON.parse(data);

                for (const s of jsonServers) {
                    await db.createServer(s);
                }
                servers = await db.getAllServers(); // Fetch again
                console.log('✅ Migration Complete.');
            }

            this.servers = servers;
            this.apis.clear();

            this.servers.forEach(server => {
                if (server.active) {
                    console.log(`Initializing API for server: ${server.name} (${server.id})`);
                    this.apis.set(server.id, new PanelApi(server.url, server.username, server.password));
                }
            });

            console.log(`✅ Loaded ${this.servers.length} servers.`);
        } catch (e) {
            console.error("Failed to load servers:", e);
        }
    }

    async addServer(serverData) {
        const result = await db.createServer(serverData);
        if (result.success) {
            await this.loadServers(); // Reload
        }
        return result;
    }

    async removeServer(id) {
        const result = await db.deleteServer(id);
        if (result.success) {
            await this.loadServers(); // Reload
        }
        return result;
    }

    getServers(freeOnly = false) {
        if (freeOnly) {
            return this.servers.filter(s => s.free && s.active);
        }
        return this.servers.filter(s => s.active);
    }

    getServer(id) {
        return this.servers.find(s => s.id === id);
    }

    getApi(serverId) {
        return this.apis.get(serverId);
    }
}

module.exports = new ServerManager();
