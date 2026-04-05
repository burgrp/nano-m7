package zaxis

import "machine"

type ZAxis struct {
	positionMm int
	pinEndStop machine.Pin
}

func NewZAxis(pinEndStop machine.Pin) *ZAxis {

	pinEndStop.Configure(machine.PinConfig{Mode: machine.PinInput})

	return &ZAxis{
		pinEndStop: pinEndStop,
	}
}

func (z *ZAxis) MoveTo(positionMm, feedrateMmMin int) {
	z.positionMm = positionMm
}

func (z *ZAxis) MoveHome() {
	z.positionMm = 0
}

func (z *ZAxis) GetZPositionMm() int {
	return z.positionMm
}

func (z *ZAxis) GetEndStop() bool {
	return z.pinEndStop.Get()
}
