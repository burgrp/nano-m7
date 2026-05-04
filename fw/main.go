package main

import (
	"device/py32"
	"errors"
	"machine"
	"runtime"
	"runtime/interrupt"
	"time"

	"github.com/burgrp/nano-m7/fw/gcode"
	"github.com/burgrp/nano-m7/fw/lamp"
	"github.com/burgrp/nano-m7/fw/panel"
	report "github.com/burgrp/nano-m7/fw/reporter"
	"github.com/burgrp/nano-m7/fw/stdio"
	"github.com/burgrp/nano-m7/fw/syscheck"
	"github.com/burgrp/nano-m7/fw/zaxis"
)

var zAxis *zaxis.ZAxis

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
	pinZMotorStep    = machine.PA8
	pinZMotorStepAf  = 2 // PA8 AF2 = TIM1_CH1
	pinZMotorDir     = machine.PB4
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

	pinUartRx.Configure(machine.PinConfig{Mode: machine.PinAlternate})
	pinUartRx.SetAltFunc(8)
	pinUartTx.Configure(machine.PinConfig{Mode: machine.PinAlternate})
	pinUartTx.SetAltFunc(8)

	machine.DefaultUART.Configure(machine.UARTConfig{})

	// Enable TIM1 and TIM3 peripheral clocks
	py32.RCC.APBENR2.SetBits(py32.RCC_APBENR2_TIM1EN)
	py32.RCC.APBENR1.SetBits(py32.RCC_APBENR1_TIM3EN)

	writer := stdio.NewWriter()
	reader := stdio.NewReader()

	writer.Write("; NANO-M7")

	lamp := lamp.NewLamp(pinLampFan, pinLampPower, pinLampPwm, pinLampPwmAf, pinLampNtc, pinLampNtcAdcCh, py32.TIM3)
	sysCheck := syscheck.NewSysCheck(pinLed, writer)
	frontPanel := panel.NewFrontPanel(pinFrontPanelLed, pinFrontPanelBtn)
	zAxis = zaxis.NewZAxis(pinZMotorStep, pinZMotorDir, pinZEndStop, pinZMotorStepAf, py32.TIM1)

	irq := interrupt.New(py32.IRQ_TIM1_BRK_UP_TRG_COM, func(interrupt.Interrupt) {
		if zAxis != nil {
			zAxis.HandleISR()
		}
	})
	irq.SetPriority(0x40)
	irq.Enable()

	reporter := report.NewReporter(frontPanel, lamp, zAxis)

	commands := gcode.Commands{
		"M700": func(args map[string]int) (string, error) {
			zAxis.Home()
			return "", nil
		},
		"M701": func(args map[string]int) (string, error) {
			steps := args["S"]
			freq := args["F"]
			if freq <= 0 {
				return "", errors.New("F (step frequency in Hz) required")
			}
			zAxis.Move(steps, freq)
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
