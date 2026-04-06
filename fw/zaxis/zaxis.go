package zaxis

import (
	"device/py32"
	"machine"
	"runtime/interrupt"
	"runtime/volatile"
)

// Machine-specific constants — adjust for leadscrew pitch and microstepping.
const (
	defaultStepsPerMm    = 1600 // 200 steps/rev × 1/16 microstepping ÷ 2 mm/rev lead
	defaultMaxFeedrateMmMin = 300
)

type ZAxis struct {
	pinDir         machine.Pin
	pinEndStop     machine.Pin
	timer          *py32.TIM_Type
	stepsPerMm     int
	positionSteps  int // current position in steps (signed)
	stepsRemaining volatile.Register32
	moving         volatile.Register32 // 1 while motion is in progress
}

// Package-level pointer for the ISR — only one ZAxis instance is expected.
var activeZAxis *ZAxis

func NewZAxis(
	pinStep, pinDir, pinEndStop machine.Pin,
	pinStepAf uint8,
	timer *py32.TIM_Type,
	stepsPerMm int,
) *ZAxis {

	if stepsPerMm <= 0 {
		stepsPerMm = defaultStepsPerMm
	}

	z := &ZAxis{
		pinDir:     pinDir,
		pinEndStop: pinEndStop,
		timer:      timer,
		stepsPerMm: stepsPerMm,
	}
	activeZAxis = z

	// -- GPIO --
	pinDir.Configure(machine.PinConfig{Mode: machine.PinOutput})
	pinEndStop.Configure(machine.PinConfig{Mode: machine.PinInputPullup})

	// -- Timer --
	// Configure step pin as timer alternate function output
	pinStep.Configure(machine.PinConfig{Mode: machine.PinAlternate})
	pinStep.SetAltFunc(pinStepAf)

	// PWM mode 1 on CH1, output compare preload enabled
	timer.SetCCMR1_Output_OC1M(py32.TIM_CCMR1_Output_OC1M_PwmMode1)
	timer.CCMR1_Output.SetBits(py32.TIM_CCMR1_Output_OC1PE)

	// Enable CH1 output, active high
	timer.CCER.SetBits(py32.TIM_CCER_CC1E)

	// TIM1 is an advanced timer: Main Output Enable must be set
	timer.BDTR.SetBits(py32.TIM_BDTR_MOE)

	// Auto-reload preload, repetition counter = 0 (UIE fires every overflow)
	timer.CR1.SetBits(py32.TIM_CR1_ARPE)
	timer.RCR.Set(0)

	// Enable update interrupt
	timer.DIER.SetBits(py32.TIM_DIER_UIE)

	irq := interrupt.New(py32.IRQ_TIM1_BRK_UP_TRG_COM, handleStepISR)
	irq.SetPriority(0x40) // higher priority than UART
	irq.Enable()

	return z
}

func handleStepISR(interrupt.Interrupt) {
	z := activeZAxis
	if z == nil {
		return
	}
	tim := z.timer
	if !tim.SR.HasBits(py32.TIM_SR_UIF) {
		return
	}
	tim.SR.ClearBits(py32.TIM_SR_UIF)

	remaining := z.stepsRemaining.Get()
	if remaining == 0 {
		return
	}
	remaining--
	z.stepsRemaining.Set(remaining)
	if remaining == 0 {
		// Stop the timer — keep CEN clear, leave BDTR/CCER intact
		tim.CR1.ClearBits(py32.TIM_CR1_CEN)
		z.moving.Set(0)
	}
}

// setStepFrequency configures PSC/ARR for the given step rate in Hz.
func (z *ZAxis) setStepFrequency(stepHz uint32) {
	total := machine.CPUFrequency() / stepHz
	psc := (total - 1) / 65536
	arr := total/(psc+1) - 1
	z.timer.PSC.Set(psc)
	z.timer.ARR.Set(arr)
	z.timer.CCR1.Set(arr / 2) // 50% duty — well above DRV8825 1.9 µs min pulse
	z.timer.SetEGR_UG(1)      // load shadow registers immediately
}

// move executes a blocking move of the given number of steps at the given feedrate.
func (z *ZAxis) move(steps int, feedrateMmMin int) {
	if steps == 0 {
		return
	}

	// Direction
	z.pinDir.Set(steps > 0)
	if steps < 0 {
		steps = -steps
	}

	stepHz := uint32(feedrateMmMin) * uint32(z.stepsPerMm) / 60
	if stepHz == 0 {
		stepHz = 1
	}

	z.setStepFrequency(stepHz)
	z.stepsRemaining.Set(uint32(steps))
	z.moving.Set(1)

	// Start timer
	z.timer.CR1.SetBits(py32.TIM_CR1_CEN)

	// Blocking wait — yield to scheduler while waiting
	for z.moving.Get() != 0 {
	}
}

// MoveTo moves to an absolute position in mm (blocking).
func (z *ZAxis) MoveTo(targetMm, feedrateMmMin int) {
	if feedrateMmMin <= 0 {
		feedrateMmMin = defaultMaxFeedrateMmMin
	}
	targetSteps := targetMm * z.stepsPerMm
	delta := targetSteps - z.positionSteps
	z.move(delta, feedrateMmMin)
	z.positionSteps = targetSteps
}

// MoveHome drives toward the endstop, then zeroes position (blocking).
func (z *ZAxis) MoveHome() {
	const homingFeedrate = 60 // mm/min — slow for reliable endstop detection

	// Move toward endstop (negative direction) in chunks until triggered
	for !z.GetEndStop() {
		z.move(-z.stepsPerMm, homingFeedrate) // 1 mm at a time
	}
	z.positionSteps = 0
}

func (z *ZAxis) GetZPositionMm() int {
	return z.positionSteps / z.stepsPerMm
}

func (z *ZAxis) GetEndStop() bool {
	return !z.pinEndStop.Get() // active low (pull-up, NPN sensor pulls to GND)
}
