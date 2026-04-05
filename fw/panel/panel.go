package panel

import "machine"

type FrontPanel struct {
	pinLed    machine.Pin
	pinButton machine.Pin
}

type Reporter interface {
	SetFrontPanelButton(state bool)
}

func NewFrontPanel(pinLed, pinButton machine.Pin) *FrontPanel {
	p := &FrontPanel{
		pinLed:    pinLed,
		pinButton: pinButton,
	}

	pinLed.Configure(machine.PinConfig{Mode: machine.PinOutput})
	pinButton.Configure(machine.PinConfig{Mode: machine.PinInput})

	return p
}

func (p *FrontPanel) SetLed(state bool) {
	p.pinLed.Set(state)
}

func (p *FrontPanel) GetFrontPanelButton() bool {
	return p.pinButton.Get()
}
