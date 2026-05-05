package net

import (
	"embed"
	"fmt"
	"net/http"

	"github.com/burgrp/nano-m7/sbc-app/pkg/log"
	"github.com/burgrp/nano-m7/sbc-app/pkg/net/impl/font_awesome"
	"github.com/burgrp/nano-m7/sbc-app/pkg/system"
	"github.com/burgrp/nano-m7/sbc-app/pkg/user"

	event "github.com/burgrp/go-event/pkg"
	webglue "github.com/burgrp/go-webglue/pkg"
)

type HttpServer struct {
}

//go:embed web_ui/*
var webResources embed.FS

//go:embed display_ui/*
var displayResources embed.FS

//go:embed common_ui/*
var commonResources embed.FS

//go:embed calibration/*
var calibrationResources embed.FS

func Init(bus *event.EventBus) {

	uiApi, uiEvents := NewUiApi(bus)

	bus.Listen(func(systemConfig system.ConfigLoaded, userConfig user.SettingsChanged) {

		commonModules := append([]*webglue.Module{
			{
				Name:      "ui",
				Api:       uiApi,
				Events:    uiEvents,
				Resources: &commonResources,
			},
			font_awesome.NewModule(),
		})

		otherHandlers := map[string]http.Handler{
			"/calibration/": http.FileServer(http.FS(calibrationResources)),
		}

		startHttpServer(fmt.Sprintf(":%v", systemConfig.Http.WebPort), &webResources, "web_ui", commonModules, otherHandlers)
		startHttpServer(fmt.Sprintf("localhost:%v", systemConfig.Http.DisplayPort), &displayResources, "display_ui", commonModules, otherHandlers)

	})

}

func startHttpServer(
	address string,
	resourcesFS *embed.FS,
	resourcesName string,
	commonModules []*webglue.Module,
	otherHandlers map[string]http.Handler,
) {

	modules := append(
		[]*webglue.Module{
			{
				Name:      resourcesName,
				Resources: resourcesFS,
			},
		},
		commonModules...,
	)

	options := webglue.Options{
		Modules: modules,
	}

	handler, err := webglue.NewHandler(options)
	if err != nil {
		panic(err)
	}

	for path, h := range otherHandlers {
		handler.Handle(path, h)
	}

	go func() {
		err = http.ListenAndServe(address, handler)
		if err != nil {
			panic(err)
		}
	}()

	log.Info("%v listening on %v", resourcesName, address)
}
