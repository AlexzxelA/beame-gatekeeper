BUILD_NUMBER ?= 0
BRANCH ?= unknown-branch

ifeq (, $(shell which chronic))
	CHRONIC=
else
	CHRONIC=chronic
endif

default:
	exit 1

.PHONY: build
build:
	$(CHRONIC) npm install
	$(CHRONIC) npm shrinkwrap
	$(CHRONIC) gulp clean compile-production
	mkdir -p build
	$(CHRONIC) rsync -aP --delete --exclude={'/public/scss','/node_modules/gulp-sass***'} --include={'/src/***','/apps/***','/node_modules/***','/config/***','/migrations/***','/models/***','/help-messages/***','/public/***','/bin/***','/admin/***','/main.js','/defaults.js','/constants.js','/package.json'} --exclude='*'   ./ ./build/$(BUILD_NUMBER)/
	jq '.build={buildNumber: $(BUILD_NUMBER), commit:"$(GIT_COMMIT)", branch:"$(GIT_BRANCH)", job:"$(JOB_NAME)"}' build/$(BUILD_NUMBER)/package.json >build/$(BUILD_NUMBER)/package.json.new
	mv build/$(BUILD_NUMBER)/package.json.new build/$(BUILD_NUMBER)/package.json
	rm build/*.tar.gz || true
	tar -C build -czf  ./build/insta-server-$(BRANCH)-$(BUILD_NUMBER).tar.gz $(BUILD_NUMBER)/
	rm -r ../../System/system/images/insta-server/artifacts/* || true
	cp ./build/insta-server-$(BRANCH)-$(BUILD_NUMBER).tar.gz ../../System/system/images/insta-server/artifacts/
