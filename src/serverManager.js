const fs = require('fs');
const path = require('path');
const PanelApi = require('./api');

const serversPath = path.resolve(__dirname, '../config/servers.json');

class ServerManager {
    constructor() {
        this.servers = [];
        this.apis = new Map(); // Map<serverId, PanelApi>
        this.loadServers();
    }

    loadServers() {
        try {
            if (fs.existsSync(serversPath)) {
                const data = fs.readFileSync(serversPath, 'utf8');
                this.servers = JSON.parse(data);

                // Initialize APIs for each server
                this.servers.forEach(server => {
                    console.log(`Initializing API for server: ${server.name} (${server.id})`);
                    this.apis.set(server.id, new PanelApi(server.url, server.username, server.password));
                });
            } else {
                console.warn("servers.json not found!");
            }
        } catch (e) {
            console.error("Failed to load servers:", e);
        }
    }

    getServers(freeOnly = false) {
        if (freeOnly) {
            return this.servers.filter(s => s.free);
        }
        return this.servers;
    }

    getServer(id) {
        return this.servers.find(s => s.id === id);
    }

    getApi(serverId) {
        return this.apis.get(serverId);
    }
}

module.exports = new ServerManager();
