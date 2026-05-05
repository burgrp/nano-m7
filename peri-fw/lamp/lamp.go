package lamp

import (
	"device/py32"
	"machine"
	"math"
)

type Lamp struct {
	pwmPeriod uint32
	pinFan    machine.Pin
	pinPower  machine.Pin
	timer     *py32.TIM_Type
}

const lampPwmTargetHz = 1000

// NTC thermistor: 100k B3950, low side of divider, upper resistor 47k.
const (
	ntcR0     = 100_000.0 // resistance at reference temperature (Ω)
	ntcT0     = 298.15    // reference temperature (K = 25°C)
	ntcB      = 3950.0    // B-parameter (K)
	ntcRUpper = 47_000.0  // upper divider resistor (Ω)
	ntcADCMax = 4095.0    // 12-bit ADC full scale
)

func NewLamp(pinFan, pinPower, pinPwm machine.Pin, pinPwmAf uint8, pinNTC machine.Pin, ntcAdcCh uint8, timer *py32.TIM_Type) *Lamp {

	lamp := &Lamp{
		pinFan:   pinFan,
		pinPower: pinPower,
		timer:    timer,
	}

	// -- GPIO setup --

	pinFan.Configure(machine.PinConfig{Mode: machine.PinOutput})
	pinPower.Configure(machine.PinConfig{Mode: machine.PinOutput})

	// -- Timer setup --

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

	// Set prescaler and period
	timer.PSC.Set(psc)
	timer.ARR.Set(arr)
	timer.CCR1.Set(0)

	// PWM mode 1 on CH1, enable output compare preload
	timer.SetCCMR1_Output_OC1M(py32.TIM_CCMR1_Output_OC1M_PwmMode1)
	timer.CCMR1_Output.SetBits(py32.TIM_CCMR1_Output_OC1PE)

	// Enable CH1 output (active high)
	timer.CCER.SetBits(py32.TIM_CCER_CC1E)

	// Enable auto-reload preload and generate update to load shadow registers
	timer.CR1.SetBits(py32.TIM_CR1_ARPE)
	timer.SetEGR_UG(1)

	// Start the counter
	timer.CR1.SetBits(py32.TIM_CR1_CEN)

	// -- ADC setup --

	// Configure PA0 as analog input (no pull)
	pinNTC.Configure(machine.PinConfig{Mode: machine.PinInputAnalog})

	// Enable ADC peripheral clock
	py32.RCC.APBENR2.SetBits(py32.RCC_APBENR2_ADCEN)

	// Clock: PCLK/2 — keeps ADC clock ≤ 16 MHz at 16/24 MHz CPU
	py32.ADC.CFGR2.Set(py32.ADC_CFGR2_CKMODE_PCLK_Div2)

	// Calibrate ADC (must be done before enabling)
	py32.ADC.CR.SetBits(py32.ADC_CR_ADCAL)
	for py32.ADC.CR.HasBits(py32.ADC_CR_ADCAL) {
	}

	// 12-bit resolution (default), single conversion mode (CONT=0, default)
	// Longest sample time — NTC + 47k upper resistor is high impedance
	py32.ADC.SMPR.Set(py32.ADC_SMPR_SMP_Cycles239_5)

	// Select ADC channel
	py32.ADC.CHSELR.Set(1 << ntcAdcCh)

	return lamp
}

// SetPwm sets the lamp brightness. s is in the range 0–255 (Marlin M106 convention).
func (l *Lamp) SetPwm(s int) {
	switch {
	case s <= 0:
		l.timer.CCR1.Set(0)
	case s >= 255:
		l.timer.CCR1.Set(l.pwmPeriod + 1)
	default:
		l.timer.CCR1.Set(uint32(s) * (l.pwmPeriod + 1) / 255)
	}
}

func (l *Lamp) SetFan(on bool) {
	if !on {
		l.SetPower(false)
	}
	l.pinFan.Set(on)
}

func (l *Lamp) SetPower(on bool) {
	if on {
		l.SetFan(true)
	}
	l.SetPwm(0)
	l.pinPower.Set(on)
}

// GetLampTempC reads the NTC thermistor and returns temperature in °C.
// NTC type: 100k B3950, low side of voltage divider, upper resistor 47k.
func (l *Lamp) GetLampTempC() int {
	// ADEN is cleared by hardware after each conversion sequence (auto power-down).
	// Re-enable per the documented procedure: write 1 to ISR bit 0 to clear ADRDY
	// (ADC_ISR_ADRDY = bit 0; absent from the register bit table but referenced in
	// the enable procedure — confirmed SVD discrepancy, no wait loop possible),
	// then set ADEN. No ADRDY wait: the bit does not exist in ADC_ISR on PY32F030.
	py32.ADC.ISR.Set(py32.ADC_ISR_ADRDY) // RC_W1: write 1 clears bit 0, others unaffected
	py32.ADC.CR.SetBits(py32.ADC_CR_ADEN)

	// Start conversion and wait for EOC
	py32.ADC.CR.SetBits(py32.ADC_CR_ADSTART)
	for !py32.ADC.ISR.HasBits(py32.ADC_ISR_EOC) {
	}
	raw := float64(py32.ADC.DR.Get()) // reading DR clears EOC

	// Voltage divider: ADC = VREF * R_ntc / (R_upper + R_ntc)
	// → R_ntc = R_upper * raw / (ADCmax - raw)
	rNtc := ntcRUpper * raw / (ntcADCMax - raw)

	// Steinhart-Hart B-parameter equation:
	// 1/T = 1/T0 + (1/B) * ln(R/R0)
	invT := 1.0/ntcT0 + math.Log(rNtc/ntcR0)/ntcB
	tempC := 1.0/invT - 273.15

	return int(tempC)
}
