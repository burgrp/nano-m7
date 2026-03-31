package main

import (
	"machine"
	"runtime"
	"time"
)

var leds = []machine.Pin{machine.PB1}

func main() {
	for n, led := range leds {
		go blinky(led, time.Duration((n+1)*1000)*time.Millisecond)
	}
	for {
		time.Sleep(500 * time.Millisecond)
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		println("-------------------")
		println("Alloc:", m.Alloc)
		println("Sys:", m.Sys)
		println("Mallocs:", m.Mallocs)
	}
}

func blinky(led machine.Pin, delay time.Duration) {
	led.Configure(machine.PinConfig{Mode: machine.PinOutput})
	for {
		led.Low()
		time.Sleep(delay / 2)

		led.High()
		time.Sleep(delay / 2)
	}
}
