package main

import (
	"device/py32"
	"errors"
	"machine"
	"runtime"
	"time"

	"github.com/burgrp/nano-m7/fw/gcode"
	"github.com/burgrp/nano-m7/fw/lamp"
	"github.com/burgrp/nano-m7/fw/stdio"
	"github.com/burgrp/nano-m7/fw/syscheck"
)

const (
	// pinUartRx  = machine.PA9
	// pinUartTx  = machine.PA10
	// pinLed     = machine.PB1
	// pinLampFan = machine.PA7
	// pinLampPower = machine.PB3
	// pinLampPwm   = machine.PA6
	// pinLampPwmAf = 1
	pinUartRx    = machine.PA8
	pinUartTx    = machine.PA7
	pinLed       = machine.PA3
	pinLampFan   = machine.PA4
	pinLampPower = machine.PB3
	pinLampPwm   = machine.PA2
	pinLampPwmAf = 13
)

func main() {
	//setClockToHSE16MHz()

	machine.ConfigureUARTPin(pinUartRx, 8)
	machine.ConfigureUARTPin(pinUartTx, 8)
	machine.DefaultUART.Configure(machine.UARTConfig{})

	// Enable TIM3 peripheral clock
	py32.RCC.APBENR1.SetBits(py32.RCC_APBENR1_TIM3EN)

	writer := stdio.NewWriter()
	reader := stdio.NewReader()

	writer.Write("; NANO-M7")

	lamp := lamp.NewLamp(pinLampFan, pinLampPower, pinLampPwm, pinLampPwmAf, py32.TIM3)
	sysCheck := syscheck.NewSysCheck(pinLed, writer)

	commands := gcode.Commands{
		"M106": func(args map[string]int) (string, error) {
			lamp.SetPwm(args["S"])
			return "", nil
		},
		"M800": func(args map[string]int) (string, error) {
			state := args["S"] == 1
			lamp.SetPower(state)
			return "", nil
		},
		"M801": func(args map[string]int) (string, error) {
			state := args["S"] == 1
			lamp.SetFan(state)
			return "", nil
		},
		"M900": func(args map[string]int) (string, error) {
			intervalMs := args["S"]
			if intervalMs <= 0 {
				return "", errors.New("invalid interval")
			}
			sysCheck.SetInterval(time.Duration(intervalMs) * time.Millisecond)
			return "", nil
		},
	}

	err := gcode.Handle(reader, writer, commands)
	if err != nil {
		panic("GCODE handler exited")
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
