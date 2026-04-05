package main

import (
	"device/py32"
	"machine"
	"runtime"
	"strconv"
	"time"
)

const (
	pinUartRx = machine.PA9
	pinUartTx = machine.PA10
	pinLed    = machine.PB1
	// pinUartRx = machine.PA8
	// pinUartTx = machine.PA7
	// pinLed    = machine.PA3
)

var blinkInterval = 50 * time.Millisecond

func main() {
	setClockToHSE16MHz()
	machine.ConfigureUARTPin(pinUartRx, 8)
	machine.ConfigureUARTPin(pinUartTx, 8)
	machine.DefaultUART.Configure(machine.UARTConfig{})

	pinLed.Configure(machine.PinConfig{Mode: machine.PinOutput})

	println("Hello, Py32!")

	go healthCheck()
	handleUART()
}

func healthCheck() {
	for {
		time.Sleep(blinkInterval)
		pinLed.Set(!pinLed.Get())

		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		print("; Alloc=")
		print(strconv.Itoa(int(m.Alloc)))
		print(" Sys=")
		print(strconv.Itoa(int(m.Sys)))
		print(" Mallocs=")
		println(strconv.Itoa(int(m.Mallocs)))

		//fmt.Println("; Alloc=", m.Alloc, " Sys=", m.Sys, " Mallocs=", m.Mallocs)
	}

}

var (
	buf  [32]byte
	bufN int
)

// handleUART drains the ring buffer filled by the UART ISR.
// Called from the main loop — no goroutine or Gosched needed.
func handleUART() {
	for {
		b, ok := machine.Serial.Buffer.Get()
		if ok {
			// print("uart: ")
			//println(b)
			//print(',')
			machine.Serial.WriteByte('.')
			machine.Serial.WriteByte(b)
		}

		runtime.Gosched()
		//time.Sleep(10000 * time.Microsecond)
	}
	// if b == '\n' || b == '\r' {
	// 	if bufN > 0 {
	// 		processGcode(buf[:bufN])
	// 		bufN = 0
	// 	}
	// } else if bufN < len(buf)-1 {
	// 	buf[bufN] = b
	// 	bufN++
	// }

	// for machine.Serial.Buffered() > 0 {
	// 	b, _ := machine.Serial.ReadByte()
	// 	print("uart: ")
	// 	println(b)
	// 	// if b == '\n' || b == '\r' {
	// 	// 	if bufN > 0 {
	// 	// 		processGcode(buf[:bufN])
	// 	// 		bufN = 0
	// 	// 	}
	// 	// } else if bufN < len(buf)-1 {
	// 	// 	buf[bufN] = b
	// 	// 	bufN++
	// 	// }
	// }
}

// processGcode handles a single GCODE line (no trailing newline).
func processGcode(line []byte) {
	// M900 S<ms> — set LED blink interval
	if hasPrefix(line, "M900") {
		ms := parseParam(line, 'S')
		if ms > 0 {
			blinkInterval = time.Duration(ms) * time.Millisecond
			println("ok")
			return
		}
		println("error")
		return
	}
	println("ok")
}

// hasPrefix checks if b starts with the ASCII prefix p.
func hasPrefix(b []byte, p string) bool {
	if len(b) < len(p) {
		return false
	}
	for i := 0; i < len(p); i++ {
		if b[i] != p[i] {
			return false
		}
	}
	return true
}

// parseParam finds parameter letter (e.g. 'S') and parses its integer value.
// Returns 0 if not found or invalid.
func parseParam(line []byte, param byte) int32 {
	for i := 0; i < len(line); i++ {
		if line[i] == param && i+1 < len(line) {
			var v int32
			for j := i + 1; j < len(line); j++ {
				c := line[j]
				if c < '0' || c > '9' {
					break
				}
				v = v*10 + int32(c-'0')
			}
			return v
		}
	}
	return 0
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
