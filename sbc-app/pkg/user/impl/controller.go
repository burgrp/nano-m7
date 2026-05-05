package user

import (
	"github.com/burgrp/nano-m7/sbc-app/pkg/common"
	"github.com/burgrp/nano-m7/sbc-app/pkg/log"
	"github.com/burgrp/nano-m7/sbc-app/pkg/system"
	"github.com/burgrp/nano-m7/sbc-app/pkg/user"

	event "github.com/burgrp/go-event/pkg"
)

func Init(bus *event.EventBus) {

	userSettings := &user.Settings{
		// set defaults here
	}

	fileName := ""

	bus.Listen(func(event system.ConfigLoaded) {
		fileName = event.UserSettings
		err := common.LoadYaml(fileName, userSettings)
		if err != nil {
			log.Warn("Failed to load user settings: %v", err)
		}

		bus.Send(user.SettingsChanged(userSettings))
	})

	saveAndNotify := func() {
		err := common.SaveYaml(fileName, userSettings)
		if err != nil {
			log.Error("Failed to save user settings: %v", err)
		}
		bus.Send(user.SettingsChanged(userSettings))
	}

	bus.Listen(func(userSettingsChanged user.SetSettings) {
		userSettings = userSettingsChanged
		saveAndNotify()
	})

}
