// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const net = require('net');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const DisplayBase = require('./DisplayBase');

class DisplayRemote extends DisplayBase {
    constructor() {
        super();
        this.displayData = {
            robotMac: '-',
            baseMac: '-',
            robotData: {},
            baseData: {},
            statusData: {},
            logs: [],
        };
    }

    terminate() {
        console.log('remote-display disconnected');
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(0);
    }

    log(message) {
        if (!this.displayLog(message)) console.log(message);
    }

    async connect() {
        this.displayStart(this.displayData, 'remote');

        this.client = net.createConnection(this.getSocketPath(), () => {
            this.log('remote-display connected');
            this.client.write(JSON.stringify({ type: 'sync' }) + '\n');
        });

        this.client.on('data', (data) => {
            for (const message of data
                .toString()
                .split('\n')
                .filter((line) => line.trim()))
                try {
                    this.process(JSON.parse(message));
                } catch {
                    // Ignore parse errors
                }
        });
        this.client.on('error', (e) => {
            if (e.code === 'ECONNREFUSED' || e.code === 'ENOENT') {
                this.displayStop();
                console.error('remote-display is not running or is not in server mode: check options');
            } else this.log('remote-display connection error: ' + e.message);
            // eslint-disable-next-line unicorn/no-process-exit
            process.exit(1);
        });
        this.client.on('close', () => {
            this.displayStop();
            this.terminate();
        });
    }

    process(message) {
        switch (message.type) {
            case 'robotData':
                Object.assign(this.displayData.robotData, message.data);
                this.displayUpdate(this.displayData);
                break;
            case 'baseData':
                Object.assign(this.displayData.baseData, message.data);
                this.displayUpdate(this.displayData);
                break;
            case 'statusData':
                Object.assign(this.displayData.statusData, message.data);
                this.displayUpdate(this.displayData);
                break;
            case 'log':
                this.displayLog(message.data);
                break;
            case 'sync':
                this.displayData = message.data;
                this.displayUpdate(this.displayData);
                this.displayData.logs?.forEach((log) => this.displayLog(log));
                break;
        }
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = DisplayRemote;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
