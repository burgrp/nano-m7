package net

import (
	"embed"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/burgrp/nano-m7/sbc-app/pkg/net/impl/font_awesome"
	"github.com/burgrp/nano-m7/sbc-app/pkg/system"
	"github.com/burgrp/nano-m7/sbc-app/pkg/user"

	event "github.com/burgrp/go-event/pkg"
	webglue "github.com/burgrp/go-webglue/pkg"
)

type HttpServer struct {
}

//go:embed ui/*
var uiResources embed.FS

func Init(bus *event.EventBus) {

	uiApi, uiEvents := NewUiApi(bus)

	bus.Listen(func(systemConfig system.ConfigLoaded, userConfig user.SettingsChanged) {

		modules :=
			[]*webglue.Module{
				{
					Name:      "ui",
					Api:       uiApi,
					Events:    uiEvents,
					Resources: &uiResources,
				},
				font_awesome.NewModule(),
			}

		options := webglue.Options{
			Modules: modules,
		}

		handler, err := webglue.NewHandler(options)
		if err != nil {
			panic(err)
		}

		go func() {
			err = http.ListenAndServe(fmt.Sprintf(":%v", systemConfig.HttpPort), handler)
			if err != nil {
				panic(err)
			}
		}()

		slog.Info("Http server listening on", "port", systemConfig.HttpPort)
	})
}
