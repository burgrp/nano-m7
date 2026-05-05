package net

import (
	"crypto/sha256"
	"fmt"
	"net/http"
	"time"

	"github.com/burgrp/nano-m7/sbc-app/pkg/common"
	"github.com/burgrp/nano-m7/sbc-app/pkg/log"
	"github.com/burgrp/nano-m7/sbc-app/pkg/system"
	systemImpl "github.com/burgrp/nano-m7/sbc-app/pkg/system/impl"
	"github.com/burgrp/nano-m7/sbc-app/pkg/user"

	event "github.com/burgrp/go-event/pkg"
	webglue "github.com/burgrp/go-webglue/pkg"
	"gopkg.in/yaml.v2"
)

type Status struct {
	TriggerSource string `json:"triggerSource"`
	TriggerLoop   bool   `json:"triggerLoop"`
	TriggerState  string `json:"triggerState"`
	Counter       int    `json:"counter"`
	HvsVolts      int    `json:"hvsVolts"`
	SamplingMode  string `json:"samplingMode"`
	Hostname      string `json:"hostname"`
	IpAddress     string `json:"ipAddress"`
	NTP           bool   `json:"ntp"`
	USB           string `json:"usb"`
}

type UiApi struct {
	status       *Status
	bus          *event.EventBus
	userSettings *user.Settings
	systemConfig *system.Config

	displayAliveCh chan bool

	authenticationTokens map[string]string
	displayToken         string
}

func NewUiApi(bus *event.EventBus) (*UiApi, []*webglue.Event) {

	api := &UiApi{
		status:               &Status{},
		bus:                  bus,
		displayAliveCh:       make(chan bool),
		authenticationTokens: make(map[string]string),
		displayToken:         fmt.Sprintf("Bearer %x", sha256.Sum256([]byte(time.Now().String()))),
	}

	statusChangedEv := webglue.NewEvent("statusChanged")
	encoderEv := webglue.NewEvent("encoderEvent")
	systemUpdateInfoEv := webglue.NewEvent("systemUpdateInfo")

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
		err := api.loadWebUiKeys()
		if err != nil {
			log.Warn("Failed to load web ui keys: %v", err)
		}
	})

	bus.Listen(func(userSettingsChanged user.SettingsChanged) {
		api.userSettings = userSettingsChanged
		statusChanged()
	})

	return api, []*webglue.Event{
		statusChangedEv,
		encoderEv,
		systemUpdateInfoEv,
	}
}

func (api *UiApi) loadWebUiKeys() error {
	tokens := make(map[string]string)

	keys := make([]string, 0)
	err := common.LoadYaml(api.systemConfig.WebUiKeys, &keys)
	if err != nil {
		return err
	}

	for _, key := range keys {
		token := fmt.Sprintf("Bearer %x", sha256.Sum256([]byte(key)))
		tokens[token] = key
	}
	api.authenticationTokens = tokens
	return nil
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

func (api *UiApi) SetSystemTime(unixTimeSec int64) error {
	return systemImpl.SetSystemTime(unixTimeSec)
}

func (api *UiApi) Authenticate(key string) (string, error) {
	for t, k := range api.authenticationTokens {
		if k == key {
			return t, nil
		}
	}
	return "", fmt.Errorf("invalid key")
}

func (api *UiApi) GetWebUiKeys() []string {
	keys := make([]string, 0, len(api.authenticationTokens))
	for _, k := range api.authenticationTokens {
		keys = append(keys, k)
	}
	return keys
}

func (api *UiApi) SetWebUiKeys(keys []string) error {
	err := common.SaveYaml(api.systemConfig.WebUiKeys, keys)
	if err != nil {
		return err
	}
	err = api.loadWebUiKeys()
	if err != nil {
		return err
	}
	return nil
}

func (api *UiApi) CheckCall(request *http.Request, functionName string) ([]any, error) {

	if functionName == "Authenticate" || len(api.authenticationTokens) == 0 {
		return nil, nil
	}

	token := request.Header.Get("Authorization")

	_, authenticated := api.authenticationTokens[token]
	if !authenticated && token != api.displayToken {
		return nil, fmt.Errorf("unauthorized")
	}

	return nil, nil
}

func (api *UiApi) AddCalibration(yamlText string) error {
	return nil
}
