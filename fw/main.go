package main

import (
	"device/py32"
	"errors"
	"machine"
	"runtime"
	"strconv"
	"time"

	"github.com/burgrp/nano-m7/fw/gcode"
	"github.com/burgrp/nano-m7/fw/line"
	"github.com/burgrp/nano-m7/fw/stdio"
)

const (
	pinUartRx = machine.PA9
	pinUartTx = machine.PA10
	pinLed    = machine.PB1
	// pinUartRx = machine.PA8
	// pinUartTx = machine.PA7
	// pinLed    = machine.PA3
)

var healthCheckInterval = 1000 * time.Millisecond

func main() {
	setClockToHSE16MHz()
	machine.ConfigureUARTPin(pinUartRx, 8)
	machine.ConfigureUARTPin(pinUartTx, 8)
	machine.DefaultUART.Configure(machine.UARTConfig{})

	pinLed.Configure(machine.PinConfig{Mode: machine.PinOutput})

	println("Hello, Py32!")

	writer := stdio.NewWriter()
	reader := stdio.NewReader()

	go healthCheck(writer)

	commands := gcode.Commands{
		"G0": func(args map[string]int) (string, error) {
			return "G0 command executed", nil
		},
		"G1": func(args map[string]int) (string, error) {
			return "", errors.New("Nazdar")
		},
	}

	err := gcode.Handle(reader, writer, commands)
	if err != nil {
		panic("GCODE handler exited")
	}

}

func healthCheck(writer line.Writer) {
	for {
		time.Sleep(healthCheckInterval)
		pinLed.Set(!pinLed.Get())

		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		_ = writer.Write("; Alloc=" + strconv.Itoa(int(m.Alloc)) + " Sys=" + strconv.Itoa(int(m.Sys)) + " Mallocs=" + strconv.Itoa(int(m.Mallocs)))
	}
}

func setClockToHSE16MHz() {
	// Set HSE frequency range to 8–16 MHz
	py32.RCC.SetECSCR_HSE_FREQ(py32.RCC_ECSCR_HSE_FREQ_Freq8_16MHz)

	// Enable HSE and wait until ready
	py32.RCC.SetCR_HSEON(py32.RCC_CR_HSEON_On)
	for py32.RCC.GetCR_HSERDY() != py32.RCC_CR_HSERDY_Ready {
	}

	// Switch system clock to HSE and wait for confirmation
	py32.RCC.SetCFGR_SW(py32.RCC_CFGR_SW_HSE)
	for py32.RCC.GetCFGR_SWS() != py32.RCC_CFGR_SWS_HSE {
	}

	// Update the frequency variable and re-initialize dependents
	machine.CPUFrequencyHz = 16_000_000
	runtime.ConfigureSystemTimer()
}
