package stdio

import "machine"

type Writer struct{}

func NewWriter() *Writer {
	return &Writer{}
}

func (w *Writer) Write(s string) error {
	for i := 0; i < len(s); i++ {
		err := machine.Serial.WriteByte(s[i])
		if err != nil {
			return err
		}
	}
	err := machine.Serial.WriteByte(byte('\n'))
	if err != nil {
		return err
	}
	return nil
}
