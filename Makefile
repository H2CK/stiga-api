
##

API=api/*.js
TESTS=tests/*.js
TOOLS=tools/*.js tools/lib/*/*.js

prettier:
	prettier --write $(API) $(TESTS) $(TOOLS)
lint:
	eslint --no-ignore $(API) $(TESTS) $(TOOLS)
.PHONY: prettier lint

##

export:
	GOOGLE_IMPERSONATE_EMAIL=matt@gream-home.net tools/stiga-database-exporter.js \
		data/capture.db \
		--format sheets --credentials ./.credentials --sheet-name "stiga capture" \
		--tail 10000

display:
	echo tools/stiga-position-viewer.js \
		data/capture.db \
		--lat 59.661918668015225 --lon 12.996299751022182 \
		--apikey `cat ./.apikey` --port 4000

monitor:
	tools/stiga-monitor.js \
		--monitor --capture \
		--timing-levels-docked=status:30s,version:60m,settings:30m --timing-levels-undocked=status:30s,version:30m,settings:5m
