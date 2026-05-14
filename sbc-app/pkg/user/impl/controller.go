package impl

import (
	"log/slog"

	"github.com/burgrp/nano-m7/sbc-app/pkg/common"
	"github.com/burgrp/nano-m7/sbc-app/pkg/system"
	"github.com/burgrp/nano-m7/sbc-app/pkg/user"

	event "github.com/burgrp/go-event/pkg"
)

func Init(bus *event.EventBus) {

	userSettings := &user.Settings{
		PrinterName: "SLA",
	}

	fileName := ""

	bus.Listen(func(event system.ConfigLoaded) {
		fileName = event.UserSettings
		err := common.LoadYaml(fileName, userSettings)
		if err != nil {
			slog.Warn("Failed to load user settings", "error", err)
		}

		if len(userSettings.Profiles) == 0 {
			slog.Info("No profiles in user settings, seeding built-in defaults")
			userSettings.Profiles = user.DefaultProfiles()
		}

		activeProfileExists := false
		firstProfileID := ""
		for id, profile := range userSettings.Profiles {
			if profile.Name == userSettings.ActiveProfile {
				activeProfileExists = true
				break
			}
			if firstProfileID == "" {
				firstProfileID = id
			}
		}
		if userSettings.ActiveProfile == "" || !activeProfileExists {
			userSettings.ActiveProfile = firstProfileID
		}

		bus.Send(user.SettingsChanged(userSettings))
	})

	saveAndNotify := func() {
		err := common.SaveYaml(fileName, userSettings)
		if err != nil {
			slog.Error("Failed to save user settings", "error", err)
		}
		bus.Send(user.SettingsChanged(userSettings))
	}

	bus.Listen(func(userSettingsChanged user.SetSettings) {
		userSettings = userSettingsChanged
		saveAndNotify()
	})

}
