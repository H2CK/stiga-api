// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const { StigaAPIUtilities, StigaAPIElements } = require('../../../api/StigaAPI');
const { protobufDecode } = StigaAPIUtilities;
const { decodeRobotStatusType, decodeRobotMowingStatus } = StigaAPIElements;

const AnalyserBase = require('./Analyser');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class GardenCompletionAnalyser extends AnalyserBase {
    static getMetadata() {
        return {
            command: 'garden-completion',
            description: 'Analyze garden completion cycles',
            detailedDescription: 'Tracks how long it takes to complete the entire garden, including both operating time and idle/error time analysis.',
            options: {},
            examples: ['stiga-analyser.js garden-completion capture.db'],
        };
    }

    constructor(databasePath) {
        super(databasePath);
        this.statusEvents = [];
        this.gardenCycles = [];
    }

    async analyze(options = {}) {
        console.log('Loading status events from database...');
        this.loadStatusEvents(options.robotMac);
        console.log(`Found ${this.statusEvents.length} status messages with mowing info`);
        console.log('\nIdentifying garden completion cycles...');
        this.identifyGardenCycles();
        console.log(`Found ${this.gardenCycles.length} complete garden cycles\n`);
        this.displayResults();
    }

    loadStatusEvents(robotMac) {
        const query = `
            SELECT timestamp, data 
            FROM messages 
            WHERE topic LIKE '%${robotMac}/LOG/STATUS%'
            ORDER BY timestamp
        `;
        for (const row of this.db.prepare(query).all()) {
            try {
                const decoded = protobufDecode(row.data);
                if (decoded[18]) {
                    const mowing = decodeRobotMowingStatus(decoded[18]);
                    const isDocked = Boolean(decoded[13] === 1);
                    const statusType = decodeRobotStatusType(decoded[3]);
                    if (mowing && mowing.gardenCompleted !== undefined) {
                        this.statusEvents.push({
                            timestamp: row.timestamp,
                            time: new Date(row.timestamp).getTime(),
                            gardenCompleted: mowing.gardenCompleted,
                            zone: mowing.zone,
                            zoneCompleted: mowing.zoneCompleted,
                            isDocked,
                            statusType,
                        });
                    }
                }
            } catch {
                // Skip messages that can't be decoded
            }
        }
    }

    isOperatingStatus(status) {
        return ['MOWING', 'GOING_HOME', 'STORING_DATA', 'PLANNING_ONGOING', 'REACHING_FIRST_POINT', 'NAVIGATING_TO_AREA', 'CUTTING_BORDER'].includes(status);
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    identifyGardenCycles() {
        if (this.statusEvents.length < 2) return;
        let cycleStart;
        let undockedTime = 0;
        let operatingTime = 0;
        let lastUndockedStart;
        let lastOperatingStart;
        let maxPercentage = 0;
        let statusBreakdown = {};
        for (let i = 0; i < this.statusEvents.length; i++) {
            const event = this.statusEvents[i],
                prevEvent = i > 0 ? this.statusEvents[i - 1] : undefined;
            if (!cycleStart && event.gardenCompleted <= 5 && !event.isDocked) {
                cycleStart = event;
                undockedTime = 0;
                operatingTime = 0;
                lastUndockedStart = event.time;
                lastOperatingStart = this.isOperatingStatus(event.statusType) ? event.time : undefined;
                maxPercentage = event.gardenCompleted;
                statusBreakdown = {};
            }
            if (cycleStart) {
                if (event.gardenCompleted > maxPercentage) maxPercentage = event.gardenCompleted;
                if (prevEvent && prevEvent.time !== event.time) {
                    const status = prevEvent.isDocked ? 'DOCKED' : prevEvent.statusType;
                    statusBreakdown[status] = (statusBreakdown[status] || 0) + (event.time - prevEvent.time);
                }
                if (prevEvent) {
                    if (!prevEvent.isDocked && event.isDocked) {
                        if (lastUndockedStart) {
                            undockedTime += event.time - lastUndockedStart;
                            lastUndockedStart = undefined;
                        }
                        if (lastOperatingStart) {
                            operatingTime += event.time - lastOperatingStart;
                            lastOperatingStart = undefined;
                        }
                    } else if (prevEvent.isDocked && !event.isDocked) {
                        lastUndockedStart = event.time;
                        if (this.isOperatingStatus(event.statusType)) lastOperatingStart = event.time;
                    } else if (!event.isDocked) {
                        const prevOperating = this.isOperatingStatus(prevEvent.statusType),
                            currOperating = this.isOperatingStatus(event.statusType);
                        if (!prevOperating && currOperating && !lastOperatingStart) lastOperatingStart = event.time;
                        else if (prevOperating && !currOperating && lastOperatingStart) {
                            operatingTime += event.time - lastOperatingStart;
                            lastOperatingStart = undefined;
                        }
                    }
                }
                if ((event.gardenCompleted >= 99 || (event.gardenCompleted <= 5 && maxPercentage > 50)) && i > 0) {
                    if (lastUndockedStart && !event.isDocked) undockedTime += event.time - lastUndockedStart;
                    if (lastOperatingStart && !event.isDocked && this.isOperatingStatus(event.statusType)) operatingTime += event.time - lastOperatingStart;
                    if (maxPercentage > 20 && undockedTime > 0) {
                        const totalTime = event.time - cycleStart.time;
                        this.gardenCycles.push({
                            startTime: cycleStart.timestamp,
                            endTime: event.timestamp,
                            startPercent: cycleStart.gardenCompleted,
                            endPercent: event.gardenCompleted,
                            maxPercent: maxPercentage,
                            totalDuration: totalTime,
                            undockedDuration: undockedTime,
                            operatingDuration: operatingTime,
                            idleDuration: undockedTime - operatingTime,
                            dockedDuration: totalTime - undockedTime,
                            undockedEfficiency: (undockedTime / totalTime) * 100,
                            operatingEfficiency: (operatingTime / totalTime) * 100,
                            statusBreakdown,
                        });
                    }
                    cycleStart = undefined;
                    undockedTime = 0;
                    operatingTime = 0;
                    lastUndockedStart = undefined;
                    lastOperatingStart = undefined;
                    maxPercentage = 0;
                    statusBreakdown = {};
                    if (event.gardenCompleted <= 5 && !event.isDocked) {
                        cycleStart = event;
                        lastUndockedStart = event.time;
                        lastOperatingStart = this.isOperatingStatus(event.statusType) ? event.time : undefined;
                        maxPercentage = event.gardenCompleted;
                        statusBreakdown = {};
                    }
                }
            }
        }
    }

    displayResults() {
        console.log('Complete Garden Cycles:');
        console.log('='.repeat(150));
        console.log('Start Time'.padEnd(25) + 'Total'.padEnd(9) + 'Undocked'.padEnd(10) + 'Operating'.padEnd(11) + 'Idle/Err'.padEnd(10) + 'Docked'.padEnd(9) + 'Und.Eff'.padEnd(9) + 'Op.Eff'.padEnd(9) + 'Max %'.padEnd(7) + 'Lost Time');
        console.log('-'.repeat(150));
        let totalUndockedTimes = [],
            totalOperatingTimes = [],
            totalIdleTimes = [],
            undockedEfficiencies = [],
            operatingEfficiencies = [];
        for (const cycle of this.gardenCycles) {
            const totalMinutes = cycle.totalDuration / (60 * 1000),
                undockedMinutes = cycle.undockedDuration / (60 * 1000),
                operatingMinutes = cycle.operatingDuration / (60 * 1000),
                idleMinutes = cycle.idleDuration / (60 * 1000),
                dockedMinutes = cycle.dockedDuration / (60 * 1000);
            if (cycle.maxPercent >= 95) {
                totalUndockedTimes.push(undockedMinutes);
                totalOperatingTimes.push(operatingMinutes);
                totalIdleTimes.push(idleMinutes);
                undockedEfficiencies.push(cycle.undockedEfficiency);
                operatingEfficiencies.push(cycle.operatingEfficiency);
            }
            console.log(
                cycle.startTime.padEnd(25) +
                    `${totalMinutes.toFixed(0)}m`.padEnd(9) +
                    `${undockedMinutes.toFixed(0)}m`.padEnd(10) +
                    `${operatingMinutes.toFixed(0)}m`.padEnd(11) +
                    `${idleMinutes.toFixed(0)}m`.padEnd(10) +
                    `${dockedMinutes.toFixed(0)}m`.padEnd(9) +
                    `${cycle.undockedEfficiency.toFixed(1)}%`.padEnd(9) +
                    `${cycle.operatingEfficiency.toFixed(1)}%`.padEnd(9) +
                    `${cycle.maxPercent}%`.padEnd(7) +
                    `${((idleMinutes / undockedMinutes) * 100).toFixed(1)}%`
            );
        }
        console.log('='.repeat(150));
        if (totalOperatingTimes.length > 0) {
            const avgUndockedTime = totalUndockedTimes.reduce((a, b) => a + b, 0) / totalUndockedTimes.length,
                avgOperatingTime = totalOperatingTimes.reduce((a, b) => a + b, 0) / totalOperatingTimes.length,
                avgIdleTime = totalIdleTimes.reduce((a, b) => a + b, 0) / totalIdleTimes.length,
                avgUndockedEff = undockedEfficiencies.reduce((a, b) => a + b, 0) / undockedEfficiencies.length,
                avgOperatingEff = operatingEfficiencies.reduce((a, b) => a + b, 0) / operatingEfficiencies.length;
            console.log('\nSummary Statistics (for cycles reaching ≥95%):');
            console.log(`  Complete garden cycles: ${totalOperatingTimes.length}`);
            console.log(`\n  Time per complete garden:`);
            console.log(`    Average undocked time: ${avgUndockedTime.toFixed(0)} minutes (${(avgUndockedTime / 60).toFixed(1)} hours)`);
            console.log(`    Average operating time: ${avgOperatingTime.toFixed(0)} minutes (${(avgOperatingTime / 60).toFixed(1)} hours)`);
            console.log(`    Average idle/error time: ${avgIdleTime.toFixed(0)} minutes (${(avgIdleTime / 60).toFixed(1)} hours)`);
            console.log(`\n  Efficiency:`);
            console.log(`    Average undocked efficiency: ${avgUndockedEff.toFixed(1)}% (undocked time vs total time)`);
            console.log(`    Average operating efficiency: ${avgOperatingEff.toFixed(1)}% (operating time vs total time)`);
            console.log(`    Average time lost to issues: ${((avgIdleTime / avgUndockedTime) * 100).toFixed(1)}% of undocked time`);
            this.showStatusBreakdown();
            const incompleteCycles = this.gardenCycles.filter((c) => c.maxPercent < 95);
            if (incompleteCycles.length > 0) console.log(`\n  Incomplete cycles: ${incompleteCycles.length} (reached ${incompleteCycles.map((c) => c.maxPercent + '%').join(', ')})`);
        } else console.log('\nNo complete garden cycles found.');
        this.showCompletionTimeline();
    }

    showStatusBreakdown() {
        console.log('\n  Status time breakdown (all cycles):');
        const totalByStatus = {};
        for (const cycle of this.gardenCycles) for (const [status, time] of Object.entries(cycle.statusBreakdown)) totalByStatus[status] = (totalByStatus[status] || 0) + time;
        for (const [status, time] of Object.entries(totalByStatus)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10))
            console.log(`    ${this.isOperatingStatus(status) ? '✓' : status === 'DOCKED' ? '⚡' : '✗'} ${status.padEnd(25)} ${(time / 60000).toFixed(0)} minutes`); // eslint-disable-line unicorn/no-nested-ternary, sonarjs/no-nested-conditional
    }

    showCompletionTimeline() {
        console.log('\n\nGarden Completion Timeline:');
        console.log('='.repeat(80));
        let currentDate,
            maxDailyCompletion = 0;
        for (const event of this.statusEvents) {
            const eventDate = new Date(event.timestamp).toISOString().split('T')[0];
            if (eventDate !== currentDate) {
                if (currentDate && maxDailyCompletion > 0) console.log(`${currentDate}: ${'█'.repeat(Math.floor(maxDailyCompletion / 5))} ${maxDailyCompletion}%`);
                currentDate = eventDate;
                maxDailyCompletion = 0;
            }
            if (event.gardenCompleted > maxDailyCompletion) maxDailyCompletion = event.gardenCompleted;
        }
        if (currentDate && maxDailyCompletion > 0) console.log(`${currentDate}: ${'█'.repeat(Math.floor(maxDailyCompletion / 5))} ${maxDailyCompletion}%`);
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = GardenCompletionAnalyser;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
