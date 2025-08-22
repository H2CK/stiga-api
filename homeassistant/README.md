# Home Assistant Addon Repository for STIGA-API

[![Open your Home Assistant instance and show the add add-on repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FH2CK%2Fstiga-api%2Fhomeassistant)

## Add-ons

### [stiga-api](./stiga-api)

This Home Assistant Addon provides a bridge between a Home Assistant instance and the cloud environment for the STIGA A-series lawn mower.
The integration in Home Assistant is realized using a MQTT broker. Therefore it is necessary to use the MQTT integration to connect the robot mower. The devices and entity in Home Assistant will be created using the MQTT discovery functionality of the MQTT integration.
