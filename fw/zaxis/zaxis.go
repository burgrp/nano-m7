package zaxis

import (
	"device/py32"
	"machine"
	"runtime"
	"runtime/volatile"
)

const defaultHomingHz = 1000

type ZAxis struct {
	pinDir        machine.Pin
	pinEndStop    machine.Pin
	pinStep       machine.Pin
	pinEn         machine.Pin
	timer         *py32.TIM_Type
	positionSteps volatile.Register32
	stepsLeft     volatile.Register32
	direction     bool
}

func NewZAxis(
	pinStep, pinDir, pinEndStop, pinEn machine.Pin,
	pinStepAf uint8,
	timer *py32.TIM_Type,
) *ZAxis {

	z := &ZAxis{
		pinDir:     pinDir,
		pinEndStop: pinEndStop,
		pinStep:    pinStep,
		pinEn:      pinEn,
		timer:      timer,
	}

	// -- GPIO --
	pinDir.Configure(machine.PinConfig{Mode: machine.PinOutput})
	pinEndStop.Configure(machine.PinConfig{Mode: machine.PinInputPullup})
	pinEn.Configure(machine.PinConfig{Mode: machine.PinOutput})
	pinEn.High() // active low: high = disabled

	// -- Timer --

	// Step pin as TIM1_CH1 alternate function output
	pinStep.SetAltFunc(pinStepAf)

	// Start with step pin as GPIO output - the output would be hi otherwise
	pinStep.Configure(machine.PinConfig{Mode: machine.PinOutput})

	// PWM mode 1 on CH1, output compare preload enabled
	timer.SetCCMR1_Output_OC1M(py32.TIM_CCMR1_Output_OC1M_PwmMode1)
	timer.CCMR1_Output.SetBits(py32.TIM_CCMR1_Output_OC1PE)

	// Enable CH1 output, active low (CC1P inverts polarity)
	timer.CCER.SetBits(py32.TIM_CCER_CC1E | py32.TIM_CCER_CC1P)

	// TIM1 advanced timer: Main Output Enable required
	timer.BDTR.SetBits(py32.TIM_BDTR_MOE)

	// Auto-reload preload; no OPM — timer runs continuously, ISR stops it
	timer.CR1.SetBits(py32.TIM_CR1_ARPE)

	// Enable update interrupt
	timer.DIER.SetBits(py32.TIM_DIER_UIE)

	return z
}

// HandleISR is called from the TIM1_BRK_UP_TRG_COM interrupt handler.
func (z *ZAxis) HandleISR() {
	z.timer.SR.ClearBits(py32.TIM_SR_UIF)

	if z.isEndStop() && !z.direction {
		// Endstop triggered: stop immediately and zero position
		z.timer.CR1.ClearBits(py32.TIM_CR1_CEN)
		z.positionSteps.Set(0)
		return
	}

	if z.stepsLeft.Get() == 0 {
		z.timer.CR1.ClearBits(py32.TIM_CR1_CEN)
		return
	}

	if z.direction {
		z.positionSteps.Set(z.positionSteps.Get() + 1)
	} else {
		z.positionSteps.Set(z.positionSteps.Get() - 1)
	}

	z.stepsLeft.Set(z.stepsLeft.Get() - 1)
}

// setStepFrequency writes PSC/ARR/CCR1 and reloads shadow registers via UG.
func (z *ZAxis) setStepFrequency(stepHz uint32) {
	total := machine.CPUFrequency() / stepHz
	psc := (total - 1) / 65536
	arr := total/(psc+1) - 1
	z.timer.PSC.Set(psc)
	z.timer.ARR.Set(arr)
	z.timer.CCR1.Set(arr / 2) // 50% duty — well above DRV8825 1.9 µs minimum pulse
	z.timer.SetEGR_UG(1)
	z.timer.SR.ClearBits(py32.TIM_SR_UIF) // UG sets UIF as side effect — clear it
}

// Move executes a relative blocking move of steps at stepHz.
// steps > 0 → positive direction, steps < 0 → negative.
func (z *ZAxis) Move(steps int, stepHz int) {

	if z.isEndStop() && steps < 0 {
		return
	}

	if steps == 0 {
		return
	}
	if stepHz <= 0 {
		stepHz = defaultHomingHz
	}

	z.pinDir.Set(steps < 0)
	if steps < 0 {
		steps = -steps
		z.direction = false
	} else {
		z.direction = true
	}

	z.setStepFrequency(uint32(stepHz))

	z.pinEn.Low() // active low: enable driver
	z.pinStep.Configure(machine.PinConfig{Mode: machine.PinAlternate})

	// stepsLeft counts down from steps to 0; ISR stops timer when it hits 0.
	// Load steps-1 because the ISR fires once before the first step completes.
	z.stepsLeft.Set(uint32(steps - 1))
	z.timer.CR1.SetBits(py32.TIM_CR1_CEN)

	// Blocking wait
	for z.timer.CR1.HasBits(py32.TIM_CR1_CEN) {
		runtime.Gosched()
	}

	z.pinStep.Configure(machine.PinConfig{Mode: machine.PinOutput})
	z.pinEn.High() // disable driver when idle

}

// Home drives toward the endstop then zeroes the position (blocking).
func (z *ZAxis) Home() {
	const MinInt = ^int(^uint(0) >> 1)
	z.Move(MinInt, defaultHomingHz)
}

func (z *ZAxis) GetPositionSteps() int {
	return int(z.positionSteps.Get())
}

func (z *ZAxis) GetEndStop() bool {
	return z.isEndStop()
}

func (z *ZAxis) isEndStop() bool {
	return !z.pinEndStop.Get() // active low: NPN sensor pulls to GND when triggered
}
