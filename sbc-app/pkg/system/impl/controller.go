package system

import (
	"os"

	"github.com/burgrp/nano-m7/sbc-app/pkg/common"
	"github.com/burgrp/nano-m7/sbc-app/pkg/system"
	"github.com/burgrp/nano-m7/sbc-app/pkg/user"

	event "github.com/burgrp/go-event/pkg"
)

func Init(bus *event.EventBus) {

	bus.Listen(func(common.ApplicationInitialized) {
		configFile := os.Getenv("CONFIG_FILE")
		if configFile == "" {
			configFile = "config.yaml"
		}

		var systemConfig system.Config
		if err := common.LoadYaml(configFile, &systemConfig); err != nil {
			panic(err)
		}

		if systemConfig.WebUiKeys == "" {
			systemConfig.WebUiKeys = "/data/sac/web-ui-keys.yaml"
		}

		bus.Send(system.ConfigLoaded(&systemConfig))
	})

	bus.Listen(func(userSettingsChanged user.SetSettings) {

	})

}
