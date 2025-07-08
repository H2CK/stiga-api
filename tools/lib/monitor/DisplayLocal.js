// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const net = require('net');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const DisplayBase = require('./DisplayBase');

class DisplayLocal extends DisplayBase {
    //

    constructor(options = {}) {
        super();
        this.displayData = {
            robotMac: options.robotMac,
            baseMac: options.baseMac,
            robotData: {},
            baseData: {},
            statusData: {},
            logs: [],
        };
        this.ipcServer = undefined;
        this.ipcClients = [];
        this.background = options.background || false;
        if (!this.background) this.displayStart(this.displayData, 'local');
        this.serverStart();
    }

    destroy() {
        if (!this.background) this.displayStop();
        this.serverStop();
    }
    terminate() {
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(0);
    }

    //

    updateRobotData(data) {
        Object.assign(this.displayData.robotData, data);
        if (!this.background) this.displayUpdate(this.displayData);
        this.serverSend('robotData', this.displayData.robotData);
    }
    updateBaseData(data) {
        Object.assign(this.displayData.baseData, data);
        if (!this.background) this.displayUpdate(this.displayData);
        this.serverSend('baseData', this.displayData.baseData);
    }
    updateStatus(processor, status) {
        this.displayData.statusData[processor] = status;
        if (!this.background) this.displayUpdate(this.displayData);
        this.serverSend('statusData', this.displayData.statusData);
    }

    //

    log(message) {
        const entry = `[${new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }).replace(' ', 'T')}] ${message}`;
        this.displayData.logs = [...this.displayData.logs, entry].slice(0, 100);
        if (!this.background) this.displayLog(entry);
        else if (this.background) console.log(entry);
        this.serverSend('log', entry);
    }

    //

    serverStart() {
        this.removeSocket();
        this.ipcServer = net.createServer((client) => {
            this.ipcClients.push(client);
            client.on('data', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'sync') client.write(JSON.stringify({ type: 'sync', data: this.displayData }) + '\n');
            });
            client.on('end', () => (this.ipcClients = this.ipcClients.filter((c) => c !== client)));
            client.on('error', () => (this.ipcClients = this.ipcClients.filter((c) => c !== client)));
        });
        this.ipcServer.listen(this.getSocketPath());
    }

    serverStop() {
        if (this.ipcServer) {
            this.ipcServer.close();
            this.removeSocket();
        }
    }

    serverSend(type, data) {
        const message = JSON.stringify({ type, data }) + '\n';
        this.ipcClients.forEach((client) => {
            try {
                client.write(message);
            } catch {
                // Remove dead clients
                this.ipcClients = this.ipcClients.filter((c) => c !== client);
            }
        });
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = DisplayLocal;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
