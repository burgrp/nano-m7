package net

import (
	"github.com/burgrp/nano-m7/sbc-app/pkg/user"

	event "github.com/burgrp/go-event/pkg"
	webglue "github.com/burgrp/go-webglue/pkg"
	"gopkg.in/yaml.v2"
)

type UiApi struct {
	bus          *event.EventBus
	userSettings *user.Settings
}

func NewUiApi(bus *event.EventBus) (*UiApi, []*webglue.Event) {

	api := &UiApi{
		bus: bus,
	}

	userSettingsChangedEv := webglue.NewEvent("userSettingsChanged")

	bus.Listen(func(userSettingsChanged user.SettingsChanged) {
		api.userSettings = userSettingsChanged
		userSettingsChangedEv.Emit(userSettingsChanged)
	})

	return api, []*webglue.Event{
		userSettingsChangedEv,
	}
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
