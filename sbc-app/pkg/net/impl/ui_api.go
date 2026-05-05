package net

import (
	"time"

	"github.com/burgrp/nano-m7/sbc-app/pkg/system"
	"github.com/burgrp/nano-m7/sbc-app/pkg/user"

	event "github.com/burgrp/go-event/pkg"
	webglue "github.com/burgrp/go-webglue/pkg"
	"gopkg.in/yaml.v2"
)

type Status struct {
}

type UiApi struct {
	status       *Status
	bus          *event.EventBus
	userSettings *user.Settings
	systemConfig *system.Config
}

func NewUiApi(bus *event.EventBus) (*UiApi, []*webglue.Event) {

	api := &UiApi{
		status: &Status{},
		bus:    bus,
	}

	statusChangedEv := webglue.NewEvent("statusChanged")

	dirty := false
	go func() {
		for {
			if dirty {
				dirty = false
				statusChangedEv.Emit(api.status)
			}
			time.Sleep(300 * time.Millisecond)
		}
	}()

	statusChanged := func() {
		dirty = true
	}

	bus.Listen(func(systemConfigLoaded system.ConfigLoaded) {
		api.systemConfig = systemConfigLoaded
	})

	bus.Listen(func(userSettingsChanged user.SettingsChanged) {
		api.userSettings = userSettingsChanged
		statusChanged()
	})

	return api, []*webglue.Event{
		statusChangedEv,
	}
}

func (api *UiApi) GetStatus() Status {
	return *api.status
}

func (api *UiApi) GetUserSettings() *user.Settings {
	return api.userSettings
}

func (api *UiApi) GetUserSettingsYaml() (string, error) {
	bytes, error := yaml.Marshal(api.userSettings)
	return string(bytes), error
}

func (api *UiApi) ApplyUserSettingsYaml(s string) (string, error) {

	var newSettings user.Settings
	err := yaml.Unmarshal([]byte(s), &newSettings)
	if err != nil {
		return "", err
	}

	api.bus.Send(user.SetSettings(&newSettings))

	return string(s), nil
}
