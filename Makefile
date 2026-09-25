DEVICE ?= tv
APP_ID = com.pyaesone.stremiosb
SERVER_VERSION = 4.20.17
VIDAA_REF = 208d437e5138adff0865443a2a88c4fcee84ece6
VIDAA_REPO = https://github.com/NoobyGains/stremio-vidaa-tv/archive/$(VIDAA_REF).tar.gz
FFMPEG_VERSION = 7.0.2
FFMPEG_URL = https://johnvansickle.com/ffmpeg/releases/ffmpeg-$(FFMPEG_VERSION)-arm64-static.tar.xz
FFMPEG_SHA256 = f4149bb2b0784e30e99bdda85471c9b5930d3402014e934a5098b41d0f7201b1
DICTIONARY_DATA_REF = f875a3b5a52be294f27e5d6907c86c253f494714
DICTIONARY_DATA_BASE = https://raw.githubusercontent.com/PyaeSoneHtun-98/stremio_dictionary/$(DICTIONARY_DATA_REF)/src/main/translation/data
VERSION = $(shell python3 -c "import json; print(json.load(open('app/appinfo.json'))['version'])")
IPK = $(APP_ID)_$(VERSION)_all.ipk

.PHONY: build test package deploy launch restart clean

service/server.js:
	@echo "==> Downloading Stremio server v$(SERVER_VERSION)..."
	@curl -so $@ "https://dl.strem.io/server/v$(SERVER_VERSION)/webos/server.js"

service/data/dictionary.json:
	@echo "==> Downloading Subtitle Bridge 30K dictionary..."
	@mkdir -p service/data
	@curl -fsSL "$(DICTIONARY_DATA_BASE)/dictionary.json" -o /tmp/subtitle-bridge-dictionary.json
	@node -e "const fs=require('fs');const x=JSON.parse(fs.readFileSync('/tmp/subtitle-bridge-dictionary.json','utf8'));if(x.version!==1||!Array.isArray(x.entries)||x.entries.length<30000)throw new Error('Unexpected dictionary dataset');fs.writeFileSync('service/data/dictionary.json',JSON.stringify(x));"
	@rm -f /tmp/subtitle-bridge-dictionary.json

service/data/phrases.json:
	@echo "==> Downloading Subtitle Bridge phrase dictionary..."
	@mkdir -p service/data
	@curl -fsSL "$(DICTIONARY_DATA_BASE)/phrases.json" -o /tmp/subtitle-bridge-phrases.json
	@node -e "const fs=require('fs');const x=JSON.parse(fs.readFileSync('/tmp/subtitle-bridge-phrases.json','utf8'));if(x.version!==1||!Array.isArray(x.entries)||x.entries.length<1000)throw new Error('Unexpected phrase dataset');fs.writeFileSync('service/data/phrases.json',JSON.stringify(x));"
	@rm -f /tmp/subtitle-bridge-phrases.json

service/bin/ffmpeg service/bin/ffprobe:
	@echo "==> Downloading static ffmpeg+ffprobe v$(FFMPEG_VERSION) (aarch64)..."
	@rm -rf /tmp/stremio-ffmpeg && mkdir -p /tmp/stremio-ffmpeg service/bin
	@curl -sLo /tmp/stremio-ffmpeg/ffmpeg.tar.xz $(FFMPEG_URL)
	@echo "$(FFMPEG_SHA256)  /tmp/stremio-ffmpeg/ffmpeg.tar.xz" | shasum -a 256 -c -
	@tar xJ --strip-components=1 -f /tmp/stremio-ffmpeg/ffmpeg.tar.xz -C /tmp/stremio-ffmpeg
	@cp /tmp/stremio-ffmpeg/ffmpeg /tmp/stremio-ffmpeg/ffprobe service/bin/
	@chmod +x service/bin/ffmpeg service/bin/ffprobe
	@rm -rf /tmp/stremio-ffmpeg

build: service/server.js service/bin/ffmpeg service/bin/ffprobe service/data/dictionary.json service/data/phrases.json
	@echo "==> Downloading Vidaa frontend..."
	@rm -rf /tmp/stremio-vidaa-build && mkdir -p /tmp/stremio-vidaa-build
	@curl -sL $(VIDAA_REPO) | tar xz --strip-components=1 -C /tmp/stremio-vidaa-build
	@echo "==> Building service/www/..."
	@rm -rf service/www && mkdir -p service/www
	@cp /tmp/stremio-vidaa-build/*.js /tmp/stremio-vidaa-build/*.wasm /tmp/stremio-vidaa-build/*.ttf /tmp/stremio-vidaa-build/*.png /tmp/stremio-vidaa-build/*.svg service/www/
	@cp service/index.html service/www/index.html
	@rm -rf /tmp/stremio-vidaa-build
	@for p in patches/*.patch; do \
		echo "    Applying $$(basename $$p)..."; \
		patch -p0 -d service/www < "$$p"; \
	done
	@echo "==> Applying Subtitle Bridge embedded subtitle POC..."
	@node scripts/apply-embedded-subtitle-poc.js service/www/video.chunk.js
	@node scripts/apply-embedded-subtitle-v106.js service/www/video.chunk.js
	@node scripts/apply-embedded-subtitle-v107.js service/www/video.chunk.js
	@grep -q 'data-subtitle-bridge-poc' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv106' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv107' service/www/video.chunk.js
	@echo "==> Applying Subtitle Bridge external subtitle POC..."
	@node scripts/apply-external-subtitle-poc.js service/www/video.chunk.js
	@node scripts/apply-embedded-subtitle-v108.js service/www/video.chunk.js
	@node scripts/apply-embedded-subtitle-v111.js service/www/video.chunk.js
	@node scripts/apply-embedded-subtitle-v112.js service/www/video.chunk.js
	@node scripts/apply-translation-v113.js service/www/video.chunk.js
	@node scripts/apply-interactions-v114.js service/www/video.chunk.js
	@node scripts/apply-word-tokenizer-v115.js service/www/video.chunk.js
	@node scripts/apply-polish-v116.js service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv108' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv111' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv112' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv113' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv114' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv115' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv116' service/www/video.chunk.js
	@grep -q 'data-subtitle-bridge-external-word' service/www/video.chunk.js
	@echo "==> Build complete"

test: build
	@echo "==> Testing embedded subtitle selection + cue POC..."
	@node --check service/www/video.chunk.js
	@node scripts/test-embedded-subtitle-poc.js service/www/video.chunk.js
	@node scripts/test-webos-subtitle-lifecycle.js service/www/video.chunk.js
	@node scripts/test-mkv-subtitle-extractor.js
	@node scripts/test-mkv-subtitle-refresh.js service/www/video.chunk.js
	@node scripts/test-dictionary-provider.js
	@node scripts/test-tv-dictionary-popup.js service/www/video.chunk.js
	@node scripts/test-tv-interactions-v114.js service/www/video.chunk.js
	@node scripts/test-tv-word-tokenizer-v115.js service/www/video.chunk.js
	@node scripts/test-mkv-cue-window-cache.js
	@node scripts/test-polish-v116.js service/www/video.chunk.js

package: test
	@rm -f $(IPK)
	@ares-package --no-minify app service -o .

deploy: package
	@for i in 1 2 3 4 5; do \
		ares-install --device $(DEVICE) $(IPK) && break || sleep 3; \
	done
	@ares-launch --device $(DEVICE) $(APP_ID)

launch:
	@ares-launch --device $(DEVICE) $(APP_ID)

restart:
	@-ares-launch --device $(DEVICE) --close $(APP_ID)
	@sleep 1
	@ares-launch --device $(DEVICE) $(APP_ID)

clean:
	rm -rf service/www service/server.js service/bin service/data *.ipk
