package main

import (
	"device/py32"
	"errors"
	"machine"
	"runtime"
	"time"

	"github.com/burgrp/nano-m7/fw/gcode"
	"github.com/burgrp/nano-m7/fw/lamp"
	"github.com/burgrp/nano-m7/fw/panel"
	report "github.com/burgrp/nano-m7/fw/reporter"
	"github.com/burgrp/nano-m7/fw/stdio"
	"github.com/burgrp/nano-m7/fw/syscheck"
	"github.com/burgrp/nano-m7/fw/zaxis"
)

const (
	// Nano-M7
	pinUartRx        = machine.PA9
	pinUartTx        = machine.PA10
	pinLed           = machine.PB1
	pinLampFan       = machine.PA7
	pinLampPower     = machine.PB3
	pinLampPwm       = machine.PA6
	pinLampPwmAf     = 1
	pinFrontPanelLed = machine.PB5
	pinFrontPanelBtn = machine.PA5
	pinZEndStop      = machine.PA4
	pinLampNtc       = machine.PA0
	pinLampNtcAdcCh  = 0

	// Embedfire
	// pinUartRx        = machine.PA8
	// pinUartTx        = machine.PA7
	// pinLed           = machine.PA3
	// pinLampFan       = machine.PB3
	// pinLampPower     = machine.PB4
	// pinLampPwm       = machine.PA2
	// pinLampPwmAf     = 13
	// pinFrontPanelLed = machine.PA4
	// pinFrontPanelBtn = machine.PA5
	// pinZEndStop      = machine.PA6
	// pinLampNtc       = machine.PA0
	// pinLampNtcAdcCh  = 0
)

func main() {
	setClockToHSE16MHz()

	machine.ConfigureUARTPin(pinUartRx, 8)
	machine.ConfigureUARTPin(pinUartTx, 8)
	machine.DefaultUART.Configure(machine.UARTConfig{})

	// Enable TIM3 peripheral clock
	py32.RCC.APBENR1.SetBits(py32.RCC_APBENR1_TIM3EN)

	writer := stdio.NewWriter()
	reader := stdio.NewReader()

	writer.Write("; NANO-M7")

	lamp := lamp.NewLamp(pinLampFan, pinLampPower, pinLampPwm, pinLampPwmAf, pinLampNtc, pinLampNtcAdcCh, py32.TIM3)
	sysCheck := syscheck.NewSysCheck(pinLed, writer)
	frontPanel := panel.NewFrontPanel(pinFrontPanelLed, pinFrontPanelBtn)
	zAxis := zaxis.NewZAxis(pinZEndStop)

	reporter := report.NewReporter(frontPanel, lamp, zAxis)

	commands := gcode.Commands{
		"G1": func(args map[string]int) (string, error) {
			if z, ok := args["Z"]; ok {
				f := args["F"]
				if f <= 0 {
					return "", errors.New("invalid feedrate")
				}
				zAxis.MoveTo(z, f)
			}
			return "", nil
		},
		"G28": func(args map[string]int) (string, error) {
			zAxis.MoveHome()
			return "", nil
		},
		"M114": func(args map[string]int) (string, error) {
			return reporter.Report()
		},
		"M800": func(args map[string]int) (string, error) {
			state := args["S"] == 1
			lamp.SetFan(state)
			return "", nil
		},
		"M801": func(args map[string]int) (string, error) {
			state := args["S"] == 1
			lamp.SetPower(state)
			return "", nil
		},
		"M802": func(args map[string]int) (string, error) {
			lamp.SetPwm(args["S"])
			return "", nil
		},
		"M810": func(args map[string]int) (string, error) {
			state := args["S"] == 1
			frontPanel.SetLed(state)
			return "", nil
		},
		"M820": func(args map[string]int) (string, error) {
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
