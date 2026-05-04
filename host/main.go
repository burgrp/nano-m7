package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/burgrp/nano-m7/host/api"
	"github.com/burgrp/nano-m7/host/display"
	"github.com/burgrp/nano-m7/host/printer"
	"github.com/burgrp/nano-m7/host/serial"
	"github.com/burgrp/nano-m7/host/store"
)

func main() {
	dataDir := flag.String("data", "./data", "data directory for plates, profiles and setup")
	addr := flag.String("addr", ":8080", "HTTP listen address")
	flag.Parse()

	st, err := store.New(*dataDir)
	if err != nil {
		log.Fatalf("store: %v", err)
	}

	setup, err := st.LoadSetup()
	if err != nil {
		log.Fatalf("setup: %v", err)
	}

	ser, err := serial.New(setup.SerialPort, setup.SerialBaud)
	if err != nil {
		log.Fatalf("serial %s: %v", setup.SerialPort, err)
	}
	defer ser.Close()
	log.Printf("serial connected: %s @ %d", setup.SerialPort, setup.SerialBaud)

	disp, err := display.New(setup.Fullscreen, int32(setup.WindowWidth), int32(setup.WindowHeight))
	if err != nil {
		log.Fatalf("display: %v", err)
	}
	defer disp.Close()

	pr := printer.New(ser, disp, st.LayerPath)

	handler := api.New(st, pr, setup)

	log.Printf("listening on %s", *addr)
	if err := http.ListenAndServe(*addr, handler); err != nil {
		log.Fatalf("http: %v", err)
	}
}
