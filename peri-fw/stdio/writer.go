package stdio

import (
	"machine"
	"sync"
)

type Writer struct {
	mu sync.Mutex
}

func NewWriter() *Writer {
	return &Writer{}
}

func (w *Writer) Write(s string) error {
	w.mu.Lock()
	defer w.mu.Unlock()

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
