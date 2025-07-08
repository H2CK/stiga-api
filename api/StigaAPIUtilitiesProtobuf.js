// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const protobuf = require('protobufjs');

const WIRE_TYPES = {
    VARINT: 0,
    FIXED64: 1,
    LENGTH_DELIMITED: 2,
    START_GROUP: 3, // Deprecated
    END_GROUP: 4, // Deprecated
    FIXED32: 5,
};

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

function protobufEncode(obj) {
    const writer = protobuf.Writer.create();
    const encode = (field, value) => {
        if (value === null || value === undefined) return;
        if (typeof value === 'boolean') {
            writer.uint32((field << 3) | WIRE_TYPES.VARINT);
            writer.bool(value);
        } else if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                writer.uint32((field << 3) | WIRE_TYPES.VARINT);
                writer.uint64(value);
            } else {
                writer.uint32((field << 3) | WIRE_TYPES.FIXED32);
                writer.float(value);
            }
        } else if (Buffer.isBuffer(value)) {
            writer.uint32((field << 3) | WIRE_TYPES.LENGTH_DELIMITED);
            writer.bytes(value);
        } else if (typeof value === 'string') {
            writer.uint32((field << 3) | WIRE_TYPES.LENGTH_DELIMITED);
            writer.string(value);
        } else if (typeof value === 'object') {
            writer.uint32((field << 3) | WIRE_TYPES.LENGTH_DELIMITED);
            writer.bytes(protobufEncode(value));
        }
    };
    for (const [key, value] of Object.entries(obj)) {
        const field = Number.parseInt(key);
        if (!Number.isNaN(field)) (Array.isArray(value) ? value : [value]).forEach((item) => encode(field, item));
    }
    return writer.finish();
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

function convertsixtyfourbits(bytes) {
    const buf = Buffer.alloc(8);
    bytes.forEach((b, i) => (buf[i] = b));
    return buf.toString('hex');
}
function convertvariableinteger(value) {
    if (typeof value === 'object' && value.toNumber) {
        const num = value.toNumber();
        if (num <= Number.MAX_SAFE_INTEGER && num >= Number.MIN_SAFE_INTEGER) return num;
    }
    return value;
}

function protobufDecode(buffer, options = {}) {
    const reader = protobuf.Reader.create(buffer);
    const decoded = {};
    while (reader.pos < reader.len) {
        const tag = reader.uint32(),
            field = tag >>> 3,
            type = tag & 7;
        if (field === 0) break;
        let value;
        switch (type) {
            case WIRE_TYPES.VARINT:
                value = convertvariableinteger(reader.uint64());
                break;
            case WIRE_TYPES.FIXED64:
                value = options.fixed64AsNumber ? reader.double() : convertsixtyfourbits(reader.fixed64().toBytesLE());
                break;
            case WIRE_TYPES.LENGTH_DELIMITED:
                const bytes = reader.bytes();
                const str = bytes.toString('utf8');
                // eslint-disable-next-line sonarjs/duplicates-in-character-class, regexp/no-dupe-characters-character-class
                if (/^[\s\x20-\x7E]*$/.test(str) && str.length > 0) value = str;
                else
                    try {
                        const nested = protobufDecode(bytes, options);
                        value = Object.keys(nested).length > 0 ? nested : bytes.toString('hex');
                    } catch {
                        value = bytes.toString('hex');
                    }
                break;
            case WIRE_TYPES.FIXED32:
                value = options.fixed32AsInt ? reader.int32() : reader.float();
                break;
            case WIRE_TYPES.START_GROUP:
            case WIRE_TYPES.END_GROUP:
                reader.skipType(type);
                continue;
            default:
                value = `wireType${type}`;
                reader.skipType(type);
        }
        if (decoded[field] === undefined) decoded[field] = value;
        else {
            if (!Array.isArray(decoded[field])) decoded[field] = [decoded[field]];
            decoded[field].push(value);
        }
    }
    return decoded;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

function stringToBytes(string) {
    let bytes = [];
    let i = 0;
    while (i < string.length) {
        const byte = Number.parseInt(string.slice(i, i + 2), 16);
        i += byte & 0x80 && i < string.length ? 4 : 2;
        bytes.push(byte);
    }
    return bytes;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

function hexToProtobuf(hexString) {
    return protobufDecode(Buffer.from(hexString, 'hex'));
}

function protobufToHex(obj) {
    return protobufEncode(obj).toString('hex');
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = {
    protobufEncode,
    protobufDecode,
    encode: protobufEncode,
    decode: protobufDecode,
    stringToBytes,
    hexToProtobuf,
    protobufToHex,
    WIRE_TYPES,
};

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
