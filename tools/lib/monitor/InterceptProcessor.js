// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const tls = require('tls');
const fs = require('fs');

const { StigaAPIUtilities, StigaAPICertificates, StigaAPIMessages } = require('../../../api/StigaAPI');
const { getCertificates } = StigaAPICertificates;
const { formatHexDump } = StigaAPIUtilities;
const { configure: configureMessage, interpret: interpretMessage } = StigaAPIMessages;

const REAL_MQTT = 'robot-mqtt-broker2.stiga.com';
const REAL_MQTT_PORT = 8883;
const REAL_REST = 'connectivity-production.stiga.com';
const REAL_REST_PORT = 443;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class InterceptProcessor {
    constructor(connection, options = {}) {
        this.connection = connection;
        this.logger = options.logger || console.log;
        this.port = options.port || 8083;
        this.logFile = options.logFile || 'intercept.log';
        this.currentComment = 'INIT';
        const certificates = getCertificates();
        this.serverOptions = {
            cert: Buffer.from(certificates.cert),
            key: Buffer.from(certificates.key),
            requestCert: false,
            rejectUnauthorized: false,
        };
        this.mqttClientOptions = {
            cert: Buffer.from(certificates.cert),
            key: Buffer.from(certificates.key),
            rejectUnauthorized: false,
        };
        this.restClientOptions = {
            rejectUnauthorized: false,
        };
        configureMessage(options);
    }

    //

    async start() {
        this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
        this.server = tls.createServer(this.serverOptions, (clientSocket) => this._handleClient(clientSocket));
        await new Promise((resolve, reject) =>
            this.server.listen(this.port, '0.0.0.0', (error) => {
                if (error) reject(error);
                else resolve();
            })
        );
        this.logger(`Intercept started on port ${this.port}`);
        this._writeLog(`Intercept proxy listening on port ${this.port}`, 'INIT');
    }

    async stop() {
        if (this.server) this.server.close();
        if (this.logStream) this.logStream.end();
        this.logger('Intercept stopped');
    }

    //

    _handleClient(clientSocket) {
        const clientAddr = clientSocket.remoteAddress;

        this._writeLog('═'.repeat(70), 'SESSION', '=');
        this._writeLog('NEW SESSION', 'SESSION');
        this._writeLog(`Time:       ${new Date().toISOString()}`, 'SESSION');
        this._writeLog(`Client:     ${clientAddr}`, 'SESSION');

        let mqttClientBuffer = Buffer.alloc(0),
            mqttTargetBuffer = Buffer.alloc(0);
        let httpClientBuffer = Buffer.alloc(0),
            httpTargetBuffer = Buffer.alloc(0);
        let protocol;
        let targetSocket;

        clientSocket.on('data', (data) => {
            if (!protocol) {
                protocol = this._detectProtocol(data);
                this._writeLog(`Protocol:   ${protocol}`, 'SESSION');
                this._writeLog('═'.repeat(70), 'SESSION', '=');
                if (protocol === 'HTTP') targetSocket = this._connectToRest(clientSocket);
                else if (protocol === 'MQTT') targetSocket = this._connectToMqtt(clientSocket);
                else {
                    this._writeLog('Unknown protocol, closing connection', 'SESSION');
                    clientSocket.end();
                    return;
                }
                targetSocket.on('data', (dataResponse) => {
                    if (protocol === 'HTTP') httpTargetBuffer = this._processHttpBuffer(Buffer.concat([httpTargetBuffer, dataResponse]), 'SERVER->APP', (data, dir) => this._parseHttpResponse(data, dir));
                    else if (protocol === 'MQTT') mqttTargetBuffer = this._processMqttBuffer(Buffer.concat([mqttTargetBuffer, dataResponse]), 'BROKER->APP', (data, dir) => this._parseMqttPacket(data, dir));
                    clientSocket.write(dataResponse);
                });
                targetSocket.on('error', (e) => {
                    this._writeLog(`Target error: ${e.message}`, 'SESSION');
                    clientSocket.destroy();
                });
                targetSocket.on('close', () => {
                    this._writeLog('Target closed', 'SESSION');
                    clientSocket.end();
                });
            }
            if (targetSocket && !targetSocket.destroyed) {
                if (protocol === 'HTTP') httpClientBuffer = this._processHttpBuffer(Buffer.concat([httpClientBuffer, data]), 'APP->SERVER', (data, dir) => this._parseHttpRequest(data, dir));
                else if (protocol === 'MQTT') mqttClientBuffer = this._processMqttBuffer(Buffer.concat([mqttClientBuffer, data]), 'APP->BROKER', (data, dir) => this._parseMqttPacket(data, dir));
                targetSocket.write(data);
            }
        });
        clientSocket.on('error', (e) => {
            this._writeLog(`Client error: ${e.message}`, 'SESSION');
            if (targetSocket) targetSocket.destroy();
        });
        clientSocket.on('close', () => {
            this._writeLog('Client closed', 'SESSION');
            this._writeLog('═'.repeat(70), 'SESSION', '=');
            if (targetSocket) targetSocket.destroy();
        });
    }

    _detectProtocol(data) {
        const str = data.toString('utf8', 0, Math.min(data.length, 10));
        if (/^(?:GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)/.test(str)) return 'HTTP';
        if (data[0] === 0x10) return 'MQTT';
        if ((data[0] & 0xf0) === 0x30) return 'MQTT';
        if (data[0] === 0x82) return 'MQTT';
        return 'UNKNOWN';
    }

    //

    _connectToMqtt(_clientSocket) {
        return tls.connect({ host: REAL_MQTT, port: REAL_MQTT_PORT, ...this.mqttClientOptions }, () => this._writeLog('Target connected to MQTT broker', 'SESSION'));
    }

    _processMqttBuffer(buffer, direction, parser) {
        while (buffer.length >= 2) {
            const { value: packetLength, bytesUsed } = this._getRemainingLength(buffer, 1);
            const totalLength = 1 + bytesUsed + packetLength;
            if (buffer.length < totalLength) break;
            parser(buffer.slice(0, totalLength), direction);
            buffer = buffer.slice(totalLength);
        }
        return buffer;
    }

    _getRemainingLength(buffer, startPos) {
        let multiplier = 1,
            value = 0,
            pos = startPos,
            byte;
        do {
            byte = buffer[pos++];
            value += (byte & 0x7f) * multiplier;
            multiplier *= 128;
        } while ((byte & 0x80) !== 0 && pos < buffer.length);
        return { value, bytesUsed: pos - startPos };
    }

    _parseMqttPacket(buffer, direction) {
        if (buffer.length < 2) return;
        const packetType = buffer[0] & 0xf0;
        if (packetType === 0x30) this._parseMqttPublish(buffer, direction);
        else if (packetType === 0x80) this._parseMqttSubscribe(buffer, direction);
    }

    _parseMqttPublish(buffer, direction) {
        const [cmd] = buffer,
            qos = (cmd & 0x06) >> 1,
            retain = (cmd & 0x01) !== 0;
        let pos = 1;
        const { bytesUsed } = this._getRemainingLength(buffer, pos);
        pos += bytesUsed;
        const topicLen = (buffer[pos] << 8) | buffer[pos + 1];
        pos += 2;
        const topic = buffer.slice(pos, pos + topicLen).toString();
        pos += topicLen;
        let messageId;
        if (qos > 0) {
            messageId = (buffer[pos] << 8) | buffer[pos + 1];
            pos += 2;
        }
        const payload = buffer.slice(pos);
        this._writeLog(`${direction} PUBLISH`, topic);
        this._writeLog(`Time:       ${new Date().toISOString()}`, topic);
        this._writeLog(`Flags:      MessageID=${messageId || 'none'}, QoS=${qos}, Retain=${retain}`, topic);
        this._writeLog(`Topic:      ${topic}`, topic);
        this._writeLog(`Length:     ${payload.length} bytes`, topic);
        if (payload.length > 0) {
            formatHexDump(payload, 'Payload:    ').forEach((line) => this._writeLog(line, topic));
            try {
                interpretMessage(topic, payload, { MAC_ROBOT: this.connection.getRobotMac(), MAC_BASE: this.connection.getBaseMac() }).forEach((line) => this._writeLog(`Decode:     ${line}`, topic));
            } catch (e) {
                this._writeLog(`Decode:     Error - ${e.message}`, topic);
            }
        }
        this._writeLog('─'.repeat(70), topic);
        this.logger(`${direction} ${topic} (${payload.length} bytes)`);
    }

    _parseMqttSubscribe(buffer, direction) {
        let pos = 1;
        const { bytesUsed } = this._getRemainingLength(buffer, pos);
        pos += bytesUsed;
        const messageId = (buffer[pos] << 8) | buffer[pos + 1];
        pos += 2;
        this._writeLog(`${direction} SUBSCRIBE`, 'SUBSCRIBE');
        this._writeLog(`Time:       ${new Date().toISOString()}`, 'SUBSCRIBE');
        this._writeLog(`Flags:      MessageID=${messageId || 'none'}`, 'SUBSCRIBE');
        while (pos < buffer.length - 1) {
            const topicLen = (buffer[pos] << 8) | buffer[pos + 1];
            if (topicLen === 0 || pos + 2 + topicLen > buffer.length) break;
            pos += 2;
            const topic = buffer.slice(pos, pos + topicLen).toString();
            pos += topicLen;
            const qos = buffer[pos++];
            this._writeLog(`Topic:      ${topic} (QoS: ${qos})`, 'SUBSCRIBE');
        }
        this._writeLog('─'.repeat(70), 'SUBSCRIBE');
    }

    //

    _connectToRest(_clientSocket) {
        return tls.connect({ host: REAL_REST, port: REAL_REST_PORT, ...this.restClientOptions }, () => this._writeLog('Target connected to REST server', 'SESSION'));
    }

    _processHttpBuffer(buffer, direction, parser) {
        while (buffer.length > 0) {
            const str = buffer.toString('utf8'),
                headerEnd = str.indexOf('\r\n\r\n');
            if (headerEnd === -1) break;
            const headers = str.slice(0, headerEnd),
                headerLines = headers.split('\r\n');
            let contentLength = 0;
            headerLines.filter((line) => line.toLowerCase().startsWith('content-length:')).forEach((line) => (contentLength = Number.parseInt(line.split(':')[1].trim())));
            const totalLength = headerEnd + 4 + contentLength;
            if (buffer.length < totalLength) break;
            parser(buffer.slice(0, totalLength), direction);
            buffer = buffer.slice(totalLength);
        }
        return buffer;
    }

    _parseHttpRequest(data, direction) {
        const str = data.toString('utf8'),
            lines = str.split('\r\n');
        const [requestLine] = lines;
        if (!requestLine) return;
        const [method, url, protocol] = requestLine.split(' ');
        this._writeLog(`${direction} HTTP REQUEST`, 'HTTP');
        this._writeLog(`Time:       ${new Date().toISOString()}`, 'HTTP');
        this._writeLog(`Method:     ${method}`, 'HTTP');
        this._writeLog(`URL:        ${url}`, 'HTTP');
        this._writeLog(`Protocol:   ${protocol}`, 'HTTP');
        this._logHttpBody(lines);
        this._writeLog('─'.repeat(70), 'HTTP');
        this.logger(`${direction} HTTP ${method} ${url}`);
    }

    _parseHttpResponse(data, direction) {
        const str = data.toString('utf8'),
            lines = str.split('\r\n');
        const [statusLine] = lines;
        if (!statusLine || !statusLine.startsWith('HTTP')) return;
        const [protocol, status, ...statusText] = statusLine.split(' ');
        this._writeLog(`${direction} HTTP RESPONSE`, 'HTTP');
        this._writeLog(`Time:       ${new Date().toISOString()}`, 'HTTP');
        this._writeLog(`Protocol:   ${protocol}`, 'HTTP');
        this._writeLog(`Status:     ${status} ${statusText.join(' ')}`, 'HTTP');
        this._logHttpBody(lines);
        this._writeLog('─'.repeat(70), 'HTTP');
        this.logger(`${direction} HTTP ${status}`);
    }

    _logHttpBody(lines) {
        let bodyStart = 0;
        let contentType = '';
        for (let i = 1; i < lines.length; i++)
            if (lines[i] === '') {
                bodyStart = i + 1;
                break;
            } else if (lines[i]) {
                this._writeLog(`Header:     ${lines[i]}`, 'HTTP');
                if (lines[i].toLowerCase().startsWith('content-type:')) contentType = lines[i].split(':')[1].trim();
            }
        if (bodyStart > 0 && bodyStart < lines.length) {
            const body = lines.slice(bodyStart).join('\r\n');
            if (body.trim()) {
                this._writeLog(`Body:       Length=${body.length} bytes${contentType ? ' (' + contentType + ')' : ''}`, 'HTTP');
                if (contentType.includes('json')) {
                    try {
                        JSON.stringify(JSON.parse(body), undefined, 2)
                            .split('\n')
                            .forEach((line) => this._writeLog(`JSON:       ${line}`, 'HTTP'));
                    } catch {
                        this._writeLog(`JSON:       [Parse Error]`, 'HTTP');
                        formatHexDump(Buffer.from(body), 'Binary:     ').forEach((line) => this._writeLog(line, 'HTTP'));
                    }
                    // eslint-disable-next-line sonarjs/duplicates-in-character-class, regexp/no-dupe-characters-character-class
                } else if (/^[\s\u0020-\u007E]*$/.test(body)) {
                    body.split('\n')
                        .filter((line) => line.trim())
                        .forEach((line) => this._writeLog(`Text:       ${line.trim()}`, 'HTTP'));
                } else {
                    formatHexDump(Buffer.from(body), 'Binary:     ').forEach((line) => this._writeLog(line, 'HTTP'));
                }
            }
        }
    }

    //

    _writeLog(message, command = '', lineChar = undefined) {
        this.logStream.write(`${new Date().toISOString()} COMMAND=${command.padEnd(48, ' ')} COMMENT=${this.currentComment} ${lineChar === undefined ? message : lineChar.repeat(70)}\n`);
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = InterceptProcessor;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
