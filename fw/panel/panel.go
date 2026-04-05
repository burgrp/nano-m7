package panel

import "machine"

type FrontPanel struct {
	pinLed machine.Pin
}

func NewFrontPanel(pinLed machine.Pin) *FrontPanel {
	p := &FrontPanel{
		pinLed: pinLed,
	}

	pinLed.Configure(machine.PinConfig{Mode: machine.PinOutput})

	return p
}

func (p *FrontPanel) SetLed(state bool) {
	p.pinLed.Set(state)
}
