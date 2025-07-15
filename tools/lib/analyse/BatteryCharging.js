// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const { StigaAPIUtilities, StigaAPIElements } = require('../../../api/StigaAPI');
const { protobufDecode } = StigaAPIUtilities;
const { decodeRobotBatteryStatus } = StigaAPIElements;

const AnalyserBase = require('./Analyser');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class BatteryChargingAnalyser extends AnalyserBase {
    static getMetadata() {
        return {
            command: 'battery-charge',
            description: 'Analyze battery charging patterns',
            detailedDescription: 'Tracks charging sessions from <30% to >80% and calculates charging rates and estimated charging times.',
            options: { '--detailed': 'Show additional statistics (charging events by hour, battery level distribution)' },
            examples: ['stiga-analyser.js battery-charge', 'stiga-analyser.js battery-charge --detailed'],
        };
    }

    constructor(databasePath) {
        super(databasePath);
        this.chargingEvents = [];
        this.chargingSessions = [];
    }

    async analyze(options = {}) {
        const showDetailed = options['--detailed'] || false;
        console.log('Loading charging events from database...');
        this.loadChargingEvents(options.robotMac);
        console.log(`Found ${this.chargingEvents.length} charging status messages`);
        console.log('\nIdentifying complete charging sessions...');
        this.identifyChargingSessions();
        console.log(`Found ${this.chargingSessions.length} complete charging sessions\n`);
        this.displayResults();
        if (showDetailed) this.getDetailedStats();
    }

    loadChargingEvents(robotMac) {
        const query = `
            SELECT timestamp, data 
            FROM messages 
            WHERE topic LIKE '%${robotMac}/LOG/STATUS%'
            ORDER BY timestamp
        `;
        for (const row of this.db.prepare(query).all()) {
            try {
                const decoded = protobufDecode(row.data);
                if (decoded[17] && decoded[3] === 3) {
                    const battery = decodeRobotBatteryStatus(decoded[17]);
                    const isDocked = Boolean(decoded[13] === 1);
                    if (battery && isDocked) {
                        this.chargingEvents.push({
                            timestamp: row.timestamp,
                            time: new Date(row.timestamp).getTime(),
                            batteryCharge: battery.charge,
                            batteryCapacity: battery.capacity,
                            isDocked,
                            statusType: 'CHARGING',
                        });
                    }
                }
            } catch {
                // Skip messages that can't be decoded
            }
        }
    }

    identifyChargingSessions() {
        if (this.chargingEvents.length < 2) return;
        let sessionStart;
        let lastEvent;
        for (const event of this.chargingEvents) {
            if (!sessionStart && event.batteryCharge < 30) {
                sessionStart = event;
                lastEvent = event;
                continue;
            }
            if (sessionStart) {
                const timeDiff = event.time - lastEvent.time;
                if (timeDiff > 30 * 60 * 1000) {
                    sessionStart = event.batteryCharge < 30 ? event : undefined;
                    lastEvent = event;
                    continue;
                }
                if (event.batteryCharge < lastEvent.batteryCharge - 2) {
                    sessionStart = event.batteryCharge < 30 ? event : undefined;
                    lastEvent = event;
                    continue;
                }
                if (event.batteryCharge > 80 && sessionStart.batteryCharge < 30) {
                    this.chargingSessions.push({
                        startTime: sessionStart.timestamp,
                        endTime: event.timestamp,
                        startCharge: sessionStart.batteryCharge,
                        endCharge: event.batteryCharge,
                        duration: event.time - sessionStart.time,
                        capacity: event.batteryCapacity,
                    });
                    sessionStart = undefined;
                }
                lastEvent = event;
            }
        }
    }

    displayResults() {
        console.log('Complete Charging Sessions (< 30% to > 80%):');
        console.log('='.repeat(100));
        console.log('Start Time'.padEnd(25) + 'Duration'.padEnd(12) + 'From %'.padEnd(8) + 'To %'.padEnd(8) + 'Change'.padEnd(10) + 'Rate'.padEnd(15) + 'Capacity');
        console.log('-'.repeat(100));
        let totalRates = [];
        for (const session of this.chargingSessions) {
            const durationMinutes = session.duration / (60 * 1000),
                chargeChange = session.endCharge - session.startCharge,
                ratePerQuarter = (chargeChange / durationMinutes) * 15;
            totalRates.push(ratePerQuarter);
            console.log(
                session.startTime.padEnd(25) +
                    `${durationMinutes.toFixed(1)} min`.padEnd(12) +
                    `${session.startCharge}%`.padEnd(8) +
                    `${session.endCharge}%`.padEnd(8) +
                    `+${chargeChange}%`.padEnd(10) +
                    `${ratePerQuarter.toFixed(2)}% / 15min`.padEnd(15) +
                    `${session.capacity} mAh`
            );
        }
        console.log('='.repeat(100));
        if (totalRates.length > 0) {
            const avgRate = totalRates.reduce((a, b) => a + b, 0) / totalRates.length,
                minRate = Math.min(...totalRates),
                maxRate = Math.max(...totalRates);
            console.log('\nSummary Statistics:');
            console.log(`  Total charging sessions analyzed: ${this.chargingSessions.length}`);
            console.log(`  Average charging rate: ${avgRate.toFixed(2)}% per 15 minutes`);
            console.log(`  Minimum charging rate: ${minRate.toFixed(2)}% per 15 minutes`);
            console.log(`  Maximum charging rate: ${maxRate.toFixed(2)}% per 15 minutes`);
            const timeFor30To80 = (50 / avgRate) * 15,
                timeFor0To100 = (100 / avgRate) * 15;
            console.log(`\nEstimated charging times (based on average rate):`);
            console.log(`  30% to 80%: ${timeFor30To80.toFixed(0)} minutes`);
            console.log(`  0% to 100%: ${timeFor0To100.toFixed(0)} minutes`);
        } else {
            console.log('\nNo complete charging sessions found.');
        }
    }

    getDetailedStats() {
        const stats = {
            totalEvents: 0,
        };
        const hours = new Map();
        const chargeBuckets = new Map();
        for (const event of this.chargingEvents) {
            stats.totalEvents++;
            const hour = new Date(event.timestamp).getHours();
            hours.set(hour, (hours.get(hour) || 0) + 1);
            const bucket = Math.floor(event.batteryCharge / 10) * 10;
            chargeBuckets.set(bucket, (chargeBuckets.get(bucket) || 0) + 1);
        }
        console.log('\n\nDetailed Statistics:');
        console.log('='.repeat(50));
        console.log(`Total charging events: ${stats.totalEvents}`);
        console.log('\nCharging events by hour of day:');
        for (let h = 0; h < 24; h++) {
            const count = hours.get(h) || 0;
            if (count > 0) console.log(`  ${h.toString().padStart(2, '0')}:00 - ${'█'.repeat(Math.ceil(count / 5))} (${count})`);
        }
        console.log('\nBattery level distribution during charging:');
        for (let b = 0; b <= 90; b += 10) {
            const count = chargeBuckets.get(b) || 0;
            if (count > 0) console.log(`  ${b}-${b + 9}%: ${'█'.repeat(Math.ceil(count / 10))} (${count})`);
        }
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = BatteryChargingAnalyser;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
