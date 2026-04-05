package line

type Reader interface {
	Read() (string, error)
}

type Writer interface {
	Write(s string) error
}
