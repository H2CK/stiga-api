ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG=C.UTF-8
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apk add --no-cache \
    nodejs \
    npm

RUN mkdir -p /var/stiga-ha-mqtt-bridge
RUN mkdir -p /var/stiga-ha-mqtt-bridge/homeassistant
COPY ../../api var/stiga-ha-mqtt-bridge/
COPY ../../package.json var/stiga-ha-mqtt-bridge/
COPY ../ha-mqtt-bridge.js /var/stiga-ha-mqtt-bridge/homeassistant/
COPY run.sh /var/stiga-ha-mqtt-bridge/
RUN chmod a+x /var/stiga-ha-mqtt-bridge/run.sh

WORKDIR /var/stiga-ha-mqtt-bridge/
RUN npm install --unsafe-perm

CMD [ "/var/stiga-ha-mqtt-bridge/run.sh" ]