// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const fs = require('fs');

const { StigaAPIUtilities, StigaAPIMessages } = require('../../../api/StigaAPI');
const { formatHexDump } = StigaAPIUtilities;
const { configure: configureMessage, interpret: interpretMessage } = StigaAPIMessages;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class ListenProcessor {
    constructor(connection, options = {}) {
        this.connection = connection;
        this.logger = options.logger || console.log;
        this.logFile = options.logFile || 'listen.log';
        this.currentComment = 'INIT';
        if (process.stdin.isTTY) {
            const readline = require('readline');
            this.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                terminal: false,
                prompt: '',
            });
            this.rl._writeToOutput = function _writeToOutput(_stringToWrite) {
                // Do nothing - prevents echo
            };
            this.rl.on('line', (input) => {
                if (!input.startsWith('/')) {
                    // Avoid conflicts with screen commands
                    this.currentComment = input.slice(0, 16).padEnd(16, ' ');
                    this._writeLog('*** USER ACTION ***', 'USER');
                }
            });
        }
        configureMessage(options);
    }

    //

    async start() {
        this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
        this._writeLog('═'.repeat(70), 'SESSION');
        this._writeLog('LISTENING FOR MQTT MESSAGES', 'SESSION');
        this._writeLog(`Robot MAC: ${this.connection.getRobotMac()}`, 'SESSION');
        this._writeLog(`Base MAC: ${this.connection.getBaseMac()}`, 'SESSION');
        this._writeLog('═'.repeat(70), 'SESSION');
        this.connection.on('message', (topic, message) => this._handleMessage(topic, message));
        this.logger(`Listen started - logging to ${this.logFile}`);
    }

    async stop() {
        if (this.rl) this.rl.close();
        if (this.logStream) this.logStream.end();
        this.logger('Listen stopped');
    }

    //

    _handleMessage(topic, message) {
        const direction = this._getDirection(topic);
        this._parsePublish(direction, topic, message);
        this.logger(`${direction} ${topic} (${message.length} bytes)`);
    }

    _getDirection(topic) {
        if (topic.includes('/CMD_ROBOT')) return '[]->ROBOT';
        if (topic.includes('CMD_ROBOT_ACK/')) return 'ROBOT->[]';
        if (topic.includes('/CMD_REFERENCE')) return '[]->BASE';
        if (topic.includes('CMD_REFERENCE_ACK/')) return 'BASE->[]';
        if (topic.includes('/LOG/') || topic.includes('/JSON_NOTIFICATION')) {
            if (topic.startsWith(this.connection.getRobotMac())) return 'ROBOT->[]';
            if (this.connection.getBaseMac() && topic.startsWith(this.connection.getBaseMac())) return 'BASE->[]';
            return 'UNKNOWN->[]';
        }
        return 'UNKNOWN';
    }

    _parsePublish(direction, topic, message) {
        const now = new Date();
        this._writeLog(`${direction} PUBLISH`, topic);
        this._writeLog(`Time:       ${now.toISOString()}`, topic);
        this._writeLog(`Topic:      ${topic}`, topic);
        this._writeLog(`Length:     ${message.length} bytes`, topic);
        if (message.length > 0) {
            formatHexDump(message, 'Payload:    ').forEach((line) => this._writeLog(line, topic));
            try {
                interpretMessage(topic, message, { MAC_ROBOT: this.connection.getRobotMac(), MAC_BASE: this.connection.getBaseMac() }).forEach((line) => this._writeLog(`Decode:     ${line}`, topic));
            } catch (e) {
                this._writeLog(`Decode:     Error - ${e.message}`, topic);
            }
        }
        this._writeLog('═'.repeat(70), topic);
    }

    //

    _writeLog(message, command = '') {
        this.logStream.write(`${new Date().toISOString()} COMMAND=${command.padEnd(48, ' ')} COMMENT=${this.currentComment} ${message}\n`);
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = ListenProcessor;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
