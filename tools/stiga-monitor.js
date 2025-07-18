#!/usr/bin/env node

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const path = require('path');
const fs = require('fs');

const DisplayLocal = require('./lib/monitor/DisplayLocal');
const DisplayRemote = require('./lib/monitor/DisplayRemote');

const ConnectionManager = require('./lib/monitor/ConnectionManager');

const CaptureProcessor = require('./lib/monitor/CaptureProcessor');
const InterceptProcessor = require('./lib/monitor/InterceptProcessor');
const ListenProcessor = require('./lib/monitor/ListenProcessor');
const MonitorProcessor = require('./lib/monitor/MonitorProcessor');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const DEFAULT_CONFIG = {
    directory: '/opt/stiga-api/data',
    mac_device: 'D0:EF:76:64:32:BA',
    mac_base: 'FC:E8:C0:72:EC:62',
    location_lat: 59.661923,
    location_lon: 12.996271,
    capture_db: 'capture.db',
    listen_file: 'listen.log',
    intercept_port: 8083,
    timing_levels_docked: 'status:30s,version:60m,settings:30m',
    timing_levels_undocked: 'status:30s,version:30m,settings:5m'
};

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

function parseTimingLevels(timingString) {
    return timingString
        .split(',')
        .map((part) => part.split(':'))
        .reduce((timing, [key, value]) => {
            if (value) {
                let milliseconds = 0;
                if (value.endsWith('s')) milliseconds = Number.parseInt(value) * 1000;
                else if (value.endsWith('m')) milliseconds = Number.parseInt(value) * 60 * 1000;
                else if (value.endsWith('h')) milliseconds = Number.parseInt(value) * 60 * 60 * 1000;
                if (milliseconds > 0 && ['version', 'settings', 'status'].includes(key)) timing[key] = milliseconds;
            }
            return timing;
        }, {});
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class StigaMonitor {
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.processors = [];
        if (!fs.existsSync(this.config.directory)) fs.mkdirSync(this.config.directory, { recursive: true });
    }

    async start() {
        const options = {
            robotMac: this.config.mac_device,
            baseMac: this.config.mac_base,
            location: { latitude: this.config.location_lat, longitude: this.config.location_lon },
        };

        this.displayLocal = new DisplayLocal({ ...options, background: this.config.background });
        options.logger = (message) => this.displayLocal.log(message);

        const { username, password } = require('../stiga_user_and_pass.js');
        this.connectionManager = new ConnectionManager(username, password, { ...options });

        if (this.config.monitor) {
            const monitor = new MonitorProcessor(this.connectionManager, this.displayLocal, {
                ...options,
                timingDocked: parseTimingLevels(this.config.timing_levels_docked),
                timingUndocked: parseTimingLevels(this.config.timing_levels_undocked),
            });
            this.processors.push(monitor);
            this.displayLocal.updateStatus('monitor', 'ACTIVE');
        }

        if (this.config.capture) {
            const database = typeof this.config.capture === 'string' ? this.config.capture : this.config.capture_db;
            const capture = new CaptureProcessor(this.connectionManager, {
                ...options,
                database: path.join(this.config.directory, database),
            });
            this.processors.push(capture);
            this.displayLocal.updateStatus('capture', path.basename(database));
        }

        if (this.config.listen) {
            const file = typeof this.config.listen === 'string' ? this.config.listen : this.config.listen_file;
            const listen = new ListenProcessor(this.connectionManager, {
                ...options,
                logFile: path.join(this.config.directory, file),
            });
            this.processors.push(listen);
            this.displayLocal.updateStatus('listen', path.basename(file));
        }

        if (this.config.intercept) {
            const port = typeof this.config.intercept === 'number' ? this.config.intercept : this.config.intercept_port;
            const file = 'intercept.log';
            const intercept = new InterceptProcessor(this.connectionManager, {
                ...options,
                port,
                logFile: path.join(this.config.directory, file),
            });
            this.processors.push(intercept);
            this.displayLocal.updateStatus('intercept', `port:${port}`);
        }

        await this.connectionManager.connect();

        for (const processor of this.processors) await processor.start();
    }

    async stop() {
        for (const processor of this.processors) await processor.stop();
        if (this.connectionManager) await this.connectionManager.disconnect();
        if (this.displayLocal) this.displayLocal.destroy();
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

function displayHelp() {
    console.error(`
Stiga Monitor

Usage:
  stiga-monitor [options]

Operating Modes:
  --connect                    Connect to running instance (client mode)
  --background                 Run without display (server mode)

Processor Options:
  --monitor                    Enable monitor mode
  --capture[=database]         Enable capture mode (default: capture.db)
  --listen[=filename]          Enable listen mode (default: listen.log)
  --intercept[=port]           Enable intercept mode (default: 8083)
  
Configuration:
  --directory=dir              Data directory (default: '/opt/stiga-api/data')
  --mac_device=MAC             Device MAC address (default: D0:EF:76:64:32:BA)
  --mac_base=MAC               Base MAC address (default: FC:E8:C0:72:EC:62)
  --location_lat=LAT           Base latitude (default: 59.661923)
  --location_lon=LON           Base longitude (default: 12.996271)

Monitor Timing Options:
  --timing-levels-docked       Timing when docked (format: status:30s,version:60m,settings:30m)
  --timing-levels-undocked     Timing when undocked (format: status:30s,version:30m,settings:5m)

Examples:
  stiga-monitor --monitor --capture=capture.db --listen=listen.log --intercept --background
  stiga-monitor --connect
`);
}

function parseArgs() {
    const config = {};
    process.argv
        .slice(2)
        .filter((arg) => arg.startsWith('--'))
        .map((arg) => arg.slice(2).split('='))
        .forEach(([key, value]) => {
            switch (key) {
                case 'capture':
                    config.capture = value || true;
                    break;
                case 'intercept':
                    config.intercept = value ? Number.parseInt(value) : true;
                    break;
                case 'listen':
                    config.listen = value || true;
                    break;
                case 'monitor':
                    config.monitor = true;
                    break;
                //
                case 'directory':
                    config.directory = value;
                    break;
                case 'mac_device':
                    config.mac_device = value;
                    break;
                case 'mac_base':
                    config.mac_base = value;
                    break;
                case 'location_lat':
                    config.location_lat = Number.parseFloat(value);
                    break;
                case 'location_lon':
                    config.location_lon = Number.parseFloat(value);
                    break;
                case 'background':
                    config.background = true;
                    break;
                case 'connect':
                    config.connect = true;
                    break;
                case 'timing-levels-docked':
                    config.timing_levels_docked = value;
                    break;
                case 'timing-levels-undocked':
                    config.timing_levels_undocked = value;
                    break;
                default:
                    console.error(`Unknown option: --${key}`);
                    process.exit(1);
            }
        });
    if (!config.connect && !config.capture && !config.intercept && !config.listen && !config.monitor) {
        displayHelp();
        process.exit(1);
    }
    return config;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

async function main() {
    const config = parseArgs();
    if (config.connect) {
        const client = new DisplayRemote();
        await client.connect();
        return;
    }
    const monitor = new StigaMonitor(config);
    ['SIGINT', 'SIGTERM'].forEach((signal) =>
        process.on(signal, async () => {
            await monitor.stop();
            process.exit(0);
        })
    );
    try {
        await monitor.start();
    } catch (e) {
        console.error('Fatal error:', e);
        await monitor.stop();
        process.exit(1);
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

main();

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
