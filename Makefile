BUILD_NUMBER ?= 0
BRANCH ?= unknown-branch
export PATH := node_modules/.bin:$(PATH)

ifeq (, $(shell which chronic))
	CHRONIC=
else
	CHRONIC=chronic
endif

default:
	exit 1

.PHONY: build build-s3
build:
	$(CHRONIC) npm install
	export version=$$(date +%Y%m%d%H%M%S) && gulp clean sass web_sass
	npm prune --production
	mkdir -p build
	jq '.build={buildNumber: $(BUILD_NUMBER), commit:"$(GIT_COMMIT)", branch:"$(GIT_BRANCH)", job:"$(JOB_NAME)"}' package.json >package.build.json
	# tar --transform='s#^#$(BUILD_NUMBER)/#' --transform='s#package.build.json#package.json#' -czf build/beame-insta-server-$(BUILD_NUMBER).tar.gz --anchored --exclude=dist --exclude='*.md' --exclude='*.text' --exclude='gulpfile.js' --exclude=build --exclude=Makefile --exclude=package.json * package.build.json
	tar --transform='s#package.build.json#package.json#' -czf build/beame-insta-server-$(BUILD_NUMBER).tar.gz --anchored --exclude=dist --exclude='*.md' --exclude='*.text' --exclude='gulpfile.js' --exclude=build --exclude=Makefile --exclude=package.json * package.build.json
	rm package.build.json

build-s3:
	$(CHRONIC) npm install
	export version=$$(date +%Y%m%d%H%M%S) && $(CHRONIC) gulp clean && $(CHRONIC) gulp sass && $(CHRONIC) gulp compile && $(CHRONIC) gulp upload-to-S3
	mkdir -p build
	$(CHRONIC) rsync -aP --delete --exclude={'/node_modules/gulp-sass***','/dist/css/***','/dist/js/***','/dist/img/***'} --include={'/src/***','/apps/***','/node_modules/***','/config/***','/migrations/***','/seeders/***','/models/***','/help-messages/***','/dist/***','/main.js','/defaults.js','/constants.js','/package.json'} --exclude='*'   ./ ./build/$(BUILD_NUMBER)/
	jq '.build={buildNumber: $(BUILD_NUMBER), commit:"$(GIT_COMMIT)", branch:"$(GIT_BRANCH)", job:"$(JOB_NAME)"}' build/$(BUILD_NUMBER)/package.json >build/$(BUILD_NUMBER)/package.json.new
	mv build/$(BUILD_NUMBER)/package.json.new build/$(BUILD_NUMBER)/package.json
	rm build/*.tar.gz || true
	tar -C build -czf  ./build/insta-server-$(BRANCH)-$(BUILD_NUMBER).tar.gz $(BUILD_NUMBER)/
	rm -r ../../System/system/images/insta-server/artifacts/* || true
	cp ./build/insta-server-$(BRANCH)-$(BUILD_NUMBER).tar.gz ../../System/system/images/insta-server/artifacts/
