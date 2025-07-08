// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const StigaAPIUtilities = { ...require('./StigaAPIUtilitiesProtobuf'), ...require('./StigaAPIUtilitiesFormat') };
const StigaAPIElements = require('./StigaAPIElements');
const StigaAPIMessages = require('./StigaAPIMessages');

const StigaAPICertificates = require('./StigaAPICertificates');
const StigaAPIAuthentication = require('./StigaAPIAuthentication');

const StigaAPIConnectionServer = require('./StigaAPIConnectionServer');
const StigaAPIConnectionMQTT = require('./StigaAPIConnectionMQTT');
const StigaAPIConnectionDevice = require('./StigaAPIConnectionDevice');

const StigaAPIUser = require('./StigaAPIUser');
const StigaAPINotifications = require('./StigaAPINotifications');
const StigaAPIGarage = require('./StigaAPIGarage');
const StigaAPIPerimeters = require('./StigaAPIPerimeters');
const StigaAPIBase = require('./StigaAPIBase');
const StigaAPIDevice = require('./StigaAPIDevice');

const StigaAPIDeviceConnector = require('./StigaAPIDeviceConnector');
const StigaAPIBaseConnector = require('./StigaAPIBaseConnector');

const StigaAPIFramework = require('./StigaAPIFramework');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = {
    StigaAPIUtilities,
    StigaAPIElements,
    StigaAPIMessages,
    //
    StigaAPICertificates,
    StigaAPIAuthentication,
    //
    StigaAPIConnectionServer,
    StigaAPIConnectionMQTT,
    StigaAPIConnectionDevice,
    //
    StigaAPIUser,
    StigaAPINotifications,
    StigaAPIGarage,
    StigaAPIPerimeters,
    StigaAPIBase,
    StigaAPIDevice,
    //
    StigaAPIDeviceConnector,
    StigaAPIBaseConnector,
    //
    StigaAPIFramework,
};

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
