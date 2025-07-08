// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const { formatStruct } = require('./StigaAPIUtilitiesFormat');
const StigaAPIComponent = require('./StigaAPIComponent');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class StigaAPIPerimeter {
    constructor(zoneData, index) {
        this.data = zoneData;
        this.index = index;
    }

    getId() {
        return this.data?.id || this.index + 1;
    }

    getArea() {
        return this.data?.m2Area || 0;
    }

    getNumPoints() {
        return this.data?.numPoints || 0;
    }

    toString() {
        return formatStruct({ id: this.getId(), area: this.getArea().toFixed(1), points: this.getNumPoints() }, 'perimeter', { area: { units: 'm2' } });
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class StigaAPIPerimeters extends StigaAPIComponent {
    constructor(serverConnection, device, options = {}) {
        super(options);
        this.server = serverConnection;
        this.device = device;
        this.perimeterData = undefined;
        this.zones = [];
        this.obstacles = [];
    }

    async load() {
        if (!this.device) {
            this.display.error('perimeters: failed to load: no device provided');
            return false;
        }

        const device_uuid = (await this.device.getUuid()).value,
            base_uuid = (await this.device.getBaseUuid()).value;
        if (!device_uuid || !base_uuid) {
            this.display.error('perimeters: failed to load: missing device or base UUID');
            return false;
        }

        try {
            const response = await this.server.get('/api/perimeters', { base_uuid, device_uuid });
            if (response.ok) {
                this.perimeterData = (await response.json()).data;
                this._parseData();
                return true;
            }
        } catch (e) {
            this.display.error('perimeters: failed to load:', e);
        }
        return false;
    }

    _parseData() {
        const preview = this.perimeterData?.attributes?.preview;
        this.zones = preview?.zones?.elements?.map((zone, index) => new StigaAPIPerimeter(zone, index)) ?? [];
        this.obstacles = preview?.obstacles?.elements?.map((obstacle, index) => new StigaAPIPerimeter(obstacle, index)) ?? [];
    }

    getZones() {
        return this.zones;
    }

    getObstacles() {
        return this.obstacles;
    }

    getTotalArea() {
        const preview = this.perimeterData?.attributes?.preview;
        return preview?.m2Area || 0;
    }

    getZonesArea() {
        const preview = this.perimeterData?.attributes?.preview;
        return preview?.zones?.m2Area || 0;
    }

    getObstaclesArea() {
        const preview = this.perimeterData?.attributes?.preview;
        return preview?.obstacles?.m2Area || 0;
    }

    getZoneCount() {
        const preview = this.perimeterData?.attributes?.preview;
        return preview?.zones?.num || 0;
    }

    getObstacleCount() {
        const preview = this.perimeterData?.attributes?.preview;
        return preview?.obstacles?.num || 0;
    }

    getTotalPoints() {
        const preview = this.perimeterData?.attributes?.preview;
        return preview?.numPoints || 0;
    }

    getChecksum() {
        const preview = this.perimeterData?.attributes?.preview;
        return preview?.checksum || undefined;
    }

    getTimestamp() {
        const preview = this.perimeterData?.attributes?.preview;
        return preview?.timestamp ? new Date(preview.timestamp) : undefined;
    }

    getReferencePosition() {
        const preview = this.perimeterData?.attributes?.preview;
        const pos = preview?.referencePosition;
        return pos?.lat && pos?.lng ? { latitude: pos.lat, longitude: pos.lng } : undefined;
    }

    getConnectPaths() {
        const preview = this.perimeterData?.attributes?.preview;
        return preview?.connectPaths || undefined;
    }

    getDockingPaths() {
        const preview = this.perimeterData?.attributes?.preview;
        return preview?.dockingPaths || undefined;
    }

    toString() {
        return formatStruct({ area: this.getTotalArea().toFixed(1), zones: this.getZoneCount(), obstacles: this.getObstacleCount() }, 'perimeter', { area: { units: 'm2' } });
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = StigaAPIPerimeters;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
