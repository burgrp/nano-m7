package main

import (
	"log/slog"
	"os"
	"os/signal"

	"github.com/burgrp/nano-m7/sbc-app/pkg/common"

	"syscall"

	net "github.com/burgrp/nano-m7/sbc-app/pkg/net/impl"
	system "github.com/burgrp/nano-m7/sbc-app/pkg/system/impl"
	user "github.com/burgrp/nano-m7/sbc-app/pkg/user/impl"

	event "github.com/burgrp/go-event/pkg"
)

func main() {

	bus := event.NewEventBus("app")
	if os.Getenv("LOG_LEVEL") == "debug" {
		handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})
		bus.SetLogger(slog.New(handler))
	}

	system.Init(bus)
	user.Init(bus)
	net.Init(bus)

	bus.Unlock()
	bus.Send(common.ApplicationInitialized{})

	cancelChan := make(chan os.Signal, 1)
	signal.Notify(cancelChan, syscall.SIGTERM, syscall.SIGINT)
	slog.Info("Application started.")
	<-cancelChan
	slog.Info("Shutting down")
}
