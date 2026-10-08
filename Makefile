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
# Desktop PR #80 validated the 061-080 vocabulary, 013-016 phrases and 19 app corrections.
DICTIONARY_EXTENSION_REF = 91cb213a7f0e77018ff7fc14ec6e93c40d872fba
DICTIONARY_EXTENSION_BASE = https://raw.githubusercontent.com/PyaeSoneHtun-98/stremio_dictionary/$(DICTIONARY_EXTENSION_REF)/src/main/translation/data
DICTIONARY_EXTENSION_SHA256 = 2c0818ba6d5d835af2a28a5d2a98c0a96b6414d0af2c252bf9caf32a1bc16086
PHRASES_EXTENSION_SHA256 = 26a932d88b8bda52638de7eaf2bc1adb78e0b36099250fa8523f550853ffbb85
DICTIONARY_CORRECTIONS_SHA256 = a12cd2cffe7da1ee3d43f7f8757b410df73dbfbf908bf4c199585adea8c9d145
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

service/data/dictionary-extension.json:
	@echo "==> Downloading verified 10K dictionary extension..."
	@mkdir -p service/data
	@curl -fsSL "$(DICTIONARY_EXTENSION_BASE)/dictionary-extension.json" -o /tmp/subtitle-bridge-dictionary-extension.json
	@node scripts/install-dictionary-asset.js /tmp/subtitle-bridge-dictionary-extension.json $@ $(DICTIONARY_EXTENSION_SHA256) 10000
	@rm -f /tmp/subtitle-bridge-dictionary-extension.json

service/data/phrases-extension.json:
	@echo "==> Downloading verified 1K phrase extension..."
	@mkdir -p service/data
	@curl -fsSL "$(DICTIONARY_EXTENSION_BASE)/phrases-extension.json" -o /tmp/subtitle-bridge-phrases-extension.json
	@node scripts/install-dictionary-asset.js /tmp/subtitle-bridge-phrases-extension.json $@ $(PHRASES_EXTENSION_SHA256) 1000
	@rm -f /tmp/subtitle-bridge-phrases-extension.json

service/data/dictionary-extension-corrections.json:
	@echo "==> Downloading verified 19 desktop dictionary corrections..."
	@mkdir -p service/data
	@curl -fsSL "$(DICTIONARY_EXTENSION_BASE)/dictionary-extension-corrections.json" -o /tmp/subtitle-bridge-dictionary-corrections.json
	@node scripts/install-dictionary-asset.js /tmp/subtitle-bridge-dictionary-corrections.json $@ $(DICTIONARY_CORRECTIONS_SHA256) 19
	@rm -f /tmp/subtitle-bridge-dictionary-corrections.json

service/bin/ffmpeg service/bin/ffprobe:
	@echo "==> Downloading static ffmpeg+ffprobe v$(FFMPEG_VERSION) (aarch64)..."
	@rm -rf /tmp/stremio-ffmpeg && mkdir -p /tmp/stremio-ffmpeg service/bin
	@curl -sLo /tmp/stremio-ffmpeg/ffmpeg.tar.xz $(FFMPEG_URL)
	@echo "$(FFMPEG_SHA256)  /tmp/stremio-ffmpeg/ffmpeg.tar.xz" | shasum -a 256 -c -
	@tar xJ --strip-components=1 -f /tmp/stremio-ffmpeg/ffmpeg.tar.xz -C /tmp/stremio-ffmpeg
	@cp /tmp/stremio-ffmpeg/ffmpeg /tmp/stremio-ffmpeg/ffprobe service/bin/
	@chmod +x service/bin/ffmpeg service/bin/ffprobe
	@rm -rf /tmp/stremio-ffmpeg

build: service/server.js service/bin/ffmpeg service/bin/ffprobe service/data/dictionary.json service/data/phrases.json service/data/dictionary-extension.json service/data/phrases-extension.json service/data/dictionary-extension-corrections.json
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
	@rm -f service/www/*.orig
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
	@node scripts/apply-indexed-mkv-v117.js service/www/video.chunk.js
	@node scripts/apply-addon-parity-v118.js service/www/video.chunk.js
	@node scripts/apply-interaction-perf-v119.js service/www/video.chunk.js
	@node scripts/apply-addon-runtime-v120.js service/www/video.chunk.js
	@node scripts/apply-performance-v122.js service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv108' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv111' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv112' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv113' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv114' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv115' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv116' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv117' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv118' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv119' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv120' service/www/video.chunk.js
	@grep -q '__subtitleBridgePOCv122' service/www/video.chunk.js
	@grep -q 'data-subtitle-bridge-external-word' service/www/video.chunk.js
	@echo "==> Build complete"

test: build
	@echo "==> Testing embedded subtitle selection + cue POC..."
	@node --check service/www/video.chunk.js
	@node scripts/test-embedded-subtitle-poc.js service/www/video.chunk.js
	@node scripts/test-webos-subtitle-lifecycle.js service/www/video.chunk.js
	@node scripts/test-subtitle-network-policy.js service/www/video.chunk.js
	@node scripts/test-mkv-subtitle-extractor.js
	@node scripts/test-mkv-subtitle-refresh.js service/www/video.chunk.js
	@node scripts/test-dictionary-provider.js
	@node scripts/test-dictionary-expansion.js
	@node scripts/test-tv-dictionary-popup.js service/www/video.chunk.js
	@node scripts/test-tv-interactions-v114.js service/www/video.chunk.js
	@node scripts/test-tv-word-tokenizer-v115.js service/www/video.chunk.js
	@node scripts/test-mkv-cue-window-cache.js
	@node scripts/test-polish-v116.js service/www/video.chunk.js
	@node scripts/test-indexed-mkv-v117.js service/www/video.chunk.js
	@node scripts/test-addon-parity-v118.js service/www/video.chunk.js
	@node scripts/test-interaction-perf-v119.js service/www/video.chunk.js
	@node scripts/test-addon-runtime-v120.js service/www/video.chunk.js
	@node scripts/test-performance-v122.js service/www/video.chunk.js
	@node --expose-gc scripts/test-resource-bounds.js
	@node scripts/benchmark-subtitle-cache.js

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
