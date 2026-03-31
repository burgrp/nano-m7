package main

import (
	"device/py32"
	"machine"
	"runtime"
	"time"
)

var leds = []machine.Pin{machine.PB1}

const (
	pinUartRx = machine.PA9
	pinUartTx = machine.PA10
	pinLed    = machine.PB1
)

func main() {
	setClockToHSE16MHz()

	pinLed.Configure(machine.PinConfig{Mode: machine.PinOutput})

	for {
		time.Sleep(500 * time.Millisecond)
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		println("-------------------")
		println("Alloc:", m.Alloc)
		println("Sys:", m.Sys)
		println("Mallocs:", m.Mallocs)
		pinLed.Set(!pinLed.Get())
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
	machine.ConfigureUARTPin(pinUartRx, 8)
	machine.ConfigureUARTPin(pinUartTx, 8)
	machine.DefaultUART.Configure(machine.UARTConfig{})
}
