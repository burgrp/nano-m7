package lamp

import (
	"device/py32"
	"machine"
)

type Lamp struct {
	pwmPeriod uint32
	pinFan    machine.Pin
	pinPower  machine.Pin
}

const lampPwmTargetHz = 1000

func NewLamp(pinFan, pinPower, pinPwm machine.Pin, pinPwmAf uint8) *Lamp {

	lamp := &Lamp{
		pinFan:   pinFan,
		pinPower: pinPower,
	}

	pinFan.Configure(machine.PinConfig{Mode: machine.PinOutput})
	pinPower.Configure(machine.PinConfig{Mode: machine.PinOutput})

	// Compute prescaler and period to hit lampPwmTargetHz.
	// timer_freq = CPU / (PSC+1), PWM_freq = timer_freq / (ARR+1)
	// → (PSC+1)*(ARR+1) = CPU / target
	total := machine.CPUFrequency() / lampPwmTargetHz
	psc := (total - 1) / 65536 // smallest PSC that keeps ARR ≤ 65535
	arr := total/(psc+1) - 1
	lamp.pwmPeriod = arr

	// Configure pin as TIM3_CH1 alternate function
	pinPwm.Configure(machine.PinConfig{Mode: machine.PinAlternate})
	pinPwm.SetAltFunc(pinPwmAf)

	// Enable TIM3 peripheral clock
	py32.RCC.APBENR1.SetBits(py32.RCC_APBENR1_TIM3EN)

	// Set prescaler and period
	py32.TIM3.PSC.Set(psc)
	py32.TIM3.ARR.Set(arr)
	py32.TIM3.CCR1.Set(0)

	// PWM mode 1 on CH1, enable output compare preload
	py32.TIM3.SetCCMR1_Output_OC1M(py32.TIM_CCMR1_Output_OC1M_PwmMode1)
	py32.TIM3.CCMR1_Output.SetBits(py32.TIM_CCMR1_Output_OC1PE)

	// Enable CH1 output (active high)
	py32.TIM3.CCER.SetBits(py32.TIM_CCER_CC1E)

	// Enable auto-reload preload and generate update to load shadow registers
	py32.TIM3.CR1.SetBits(py32.TIM_CR1_ARPE)
	py32.TIM3.SetEGR_UG(1)

	// Start the counter
	py32.TIM3.CR1.SetBits(py32.TIM_CR1_CEN)

	return lamp
}

// setLampPwm sets the lamp brightness. s is in the range 0–255 (Marlin M106 convention).
func (l *Lamp) SetPwm(s int) {
	switch {
	case s <= 0:
		py32.TIM3.CCR1.Set(0)
	case s >= 255:
		py32.TIM3.CCR1.Set(l.pwmPeriod + 1)
	default:
		py32.TIM3.CCR1.Set(uint32(s) * (l.pwmPeriod + 1) / 255)
	}
}

func (l *Lamp) SetFan(on bool) {
	l.pinPower.Set(on)
}

func (l *Lamp) SetPower(on bool) {
	l.pinFan.Set(on)
}
