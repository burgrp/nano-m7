package stdio

import (
	"machine"
	"runtime"
)

type Reader struct{}

func NewReader() *Reader {
	return &Reader{}
}

func (r *Reader) Read() (string, error) {
	var buf [64]byte
	n := 0
	for n < len(buf) {
		b, ok := machine.Serial.Buffer.Get()
		if ok {
			buf[n] = b
			n++
			if b == '\n' || b == '\r' {
				break
			}
		} else {
			runtime.Gosched()
		}
	}
	return string(buf[:n]), nil
}
