// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const EventEmitter = require('events');
const { StigaAPIConnectionMQTT, StigaAPIElements } = require('../../../api/StigaAPI');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class ConnectionManager extends EventEmitter {
    constructor(username, password, options = {}) {
        super();

        this.username = username;
        this.password = password;
        this.robotMac = options.robotMac;
        this.baseMac = options.baseMac;
        this.logger = options.logger || console.log;

        this.includeAcks = true;
        this.topics = [...StigaAPIElements.buildRobotMessageTopics(this.robotMac, this.includeAcks), ...StigaAPIElements.buildBaseMessageTopics(this.baseMac, this.includeAcks)];

        this.connected = false;
        this.connection = new StigaAPIConnectionMQTT(username, password, { client: 'unified', logger: this.logger, topics: this.topics });
        this.messageHandlers = new Map();
    }

    async connect() {
        if (this.connected) return true;
        try {
            await this.connection.connect('broker2', (topic, message) => this._handleMessage(topic, message));
            this.connected = true;
            this.logger('Connected to MQTT broker');
            for (const topic of this.topics) this.logger(`Subscribed to ${topic}`);
            return true;
        } catch (e) {
            this.logger(`Failed to connect: ${e.message}`);
            throw e;
        }
    }

    async disconnect() {
        if (!this.connected) return;
        this.connection.disconnect();
        this.connected = false;
        this.logger('Disconnected from MQTT broker');
    }

    _handleMessage(topic, message) {
        this.emit('message', topic, message);
        this.emit(`topic:${topic}`, message);
        const patterns = [
            { pattern: /\/LOG\//, event: 'log' },
            { pattern: /CMD_ROBOT/, event: 'robot_command' },
            { pattern: /CMD_REFERENCE/, event: 'base_command' },
            { pattern: /JSON_NOTIFICATION/, event: 'notification' },
        ];
        for (const { pattern, event } of patterns) if (pattern.test(topic)) this.emit(event, topic, message);
    }

    publish(topic, message, options = {}) {
        return this.connected ? this.connection.publish(topic, message, options) : false;
    }

    isConnected() {
        return this.connected;
    }

    getRobotMac() {
        return this.robotMac;
    }

    getBaseMac() {
        return this.baseMac;
    }

    getTopics() {
        return this.topics;
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = ConnectionManager;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
