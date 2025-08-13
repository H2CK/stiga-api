// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const mqtt = require('mqtt');

const StigaAPIAuthentication = require('./StigaAPIAuthentication');
const StigaAPICertificates = require('./StigaAPICertificates');
const StigaAPIComponent = require('./StigaAPIComponent');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class StigaAPIConnectionMQTT extends StigaAPIComponent {
    static getBrokerURL(brokerId) {
        if (brokerId === undefined) {
            brokerId = "broker";
        }
        return `mqtts://robot-mqtt-${brokerId}.stiga.com:8883`;
    }
    static getBrokerUsername() {
        return 'firebaseauth|connectivity-production.stiga.com';
    }
    static getBrokerPassword(auth) {
        return auth.token;
    }

    constructor(username, password, options = {}) {
        super(options);
        this.username = username;
        this.password = password;
        this.clientId = `${options.client || 'mqtt'}_${Date.now()}_${Math.random().toString(36).slice(7)}`;
        this.connected = false;
        this.topics = options.topics || [];
    }
    async authenticate(brokerId) {
        // let { broker, certificates, username, password } = await this.authenticate(brokerId);
        if (!this.auth) this.auth = new StigaAPIAuthentication(this.username, this.password);
        if (!(await this.auth.isValid())) throw new Error('Authentication failed');
        this.display.debug('Authentication succeeded');
        return {
            broker: StigaAPIConnectionMQTT.getBrokerURL(brokerId),
            certificates: StigaAPICertificates.getCertificates(brokerId),
            username: StigaAPIConnectionMQTT.getBrokerUsername(),
            password: StigaAPIConnectionMQTT.getBrokerPassword(this.auth),
        };
    }
    async connect(brokerId, handler) {
        let { broker, certificates, username, password } = await this.authenticate(brokerId);
        const options = {
            cert: Buffer.from(certificates.cert),
            key: Buffer.from(certificates.key),
            rejectUnauthorized: false,
            username,
            password,
            clientId: this.clientId,
            clean: true,
            reconnectPeriod: 5000,
        };
        this.display.debug(`connection: mqtt connect request (broker=${broker}, clientId=${this.clientId})`);
        this.client = mqtt.connect(broker, options);
        return new Promise((resolve, reject) => {
            this.client.once('connect', () => {
                this.display.debug('connection: mqtt connect success');
                this.connected = true;
                const subscribePromises = this.topics.map(
                    (topic) =>
                        // eslint-disable-next-line sonarjs/no-nested-functions
                        new Promise((subResolve, subReject) =>
                            this.client.subscribe(topic, { qos: 0 }, (err) => {
                                if (err) {
                                    this.display.error(`connection: mqtt subscribe failure (topic=${topic}): ${err}`);
                                    subReject(err);
                                } else {
                                    this.display.debug(`connection: mqtt subscribe success (topic=${topic})`);
                                    subResolve();
                                }
                            })
                        )
                );
                Promise.all(subscribePromises).then(resolve).catch(reject);
            });
            this.client.on('message', (topic, message) => {
                handler(topic, message);
            });
            this.client.on('error', (err) => {
                this.display.error('connection: mqtt error:', err);
                this.connected = false;
            });
            this.client.on('close', () => {
                this.display.debug('connection: mqtt closed');
                this.connected = false;
            });
            this.client.on('reconnect', async () => {
                this.display.debug('connection: mqtt reconnect');
                ({ username, password } = await this.authenticate(brokerId));
                this.client.options.username = username;
                this.client.options.password = password;
            });
        });
    }
    disconnect() {
        if (this.client) {
            this.client.end();
            delete this.client;
            this.client = undefined;
            this.display.debug('connection: disconnected');
        }
    }
    publish(topic, message, options = {}, callback = undefined) {
        return this.client.publish(topic, message, options, callback);
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = StigaAPIConnectionMQTT;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
