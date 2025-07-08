// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class CaptureProcessor {
    constructor(connection, options = {}) {
        this.connection = connection;
        this.logger = options.logger || console.log;

        this.databasePath = options.database;
        this.databaseInsertStatement = undefined;
        this.databaseWriteQueue = [];
        this.databaseBatchSize = 1000;
        this.databaseFlushLast = Date.now();
        this.databaseFlushInterval = 5000; // 5 seconds

        this.stats = {
            messages: 0,
            topics: {},
        };
    }

    async start() {
        this.databaseStart();
        this.connection.on('message', (topic, message) => this.messageHandle(topic, message));
        this.logger(`Capture started`);
    }

    async stop() {
        this.databaseStop();
        this.logger('Capture stopped');
    }

    //

    databaseStart() {
        const dir = path.dirname(this.databasePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        this.database = new Database(this.databasePath);
        this.database.pragma('journal_mode = WAL');
        this.database.pragma('synchronous = NORMAL');
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                topic TEXT NOT NULL,
                data BLOB NOT NULL
            )
        `);
        this.database.exec(`
            CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);
            CREATE INDEX IF NOT EXISTS idx_topic ON messages(topic);
            CREATE INDEX IF NOT EXISTS idx_timestamp_topic ON messages(timestamp, topic);
        `);
        this.databaseInsertStatement = this.database.prepare('INSERT INTO messages (timestamp, topic, data) VALUES (?, ?, ?)');
        const count = this.database.prepare('SELECT COUNT(*) as count FROM messages').get();
        this.databaseFlushTimer = setInterval(() => this.databaseFlush(), this.databaseFlushInterval);
        this.logger(`Capture output: database ${this.databasePath}, opened with ${count.count} messages`);
    }

    databaseStop() {
        if (this.databaseFlushTimer) clearInterval(this.databaseFlushTimer);
        this.databaseFlush();
        if (this.database) this.database.close();
    }

    databaseFlush() {
        if (this.databaseWriteQueue.length === 0) return;
        const insertMany = this.database.transaction((inserts) => {
            for (const insert of inserts) this.databaseInsertStatement.run(...insert);
        });
        try {
            insertMany(this.databaseWriteQueue);
            this.databaseWriteQueue = [];
            this.databaseFlushLast = Date.now();
        } catch (e) {
            this.logger(`Capture database insert error: ${e.message}`);
        }
    }

    databaseWrite(timestamp, topic, message) {
        if (this.database) this.databaseWriteQueue.push([timestamp, topic, message]);
    }

    //

    messageHandle(topic, message) {
        const timestamp = new Date().toISOString();
        this.stats.messages++;
        this.stats.topics[topic] = (this.stats.topics[topic] || 0) + 1;
        this.databaseWrite(timestamp, topic, message);
    }

    //

    statsDisplay() {
        const topicStats = Object.entries(this.stats.topics)
            .map(([topic, messages]) => `${topic.split('/').pop()}=${messages}`)
            .join(', ');
        this.logger(`Capture stats: ${this.stats.messages} messages, topics: ${topicStats}`);
        this.stats.messages = 0;
        this.stats.topics = {};
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = CaptureProcessor;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
