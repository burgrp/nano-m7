package common

type StringEnum[T ~int] map[T]string

func (e StringEnum[T]) ToString(i T) string {
	for k, v := range e {
		if k == i {
			return v
		}
	}
	for _, v := range e {
		return v
	}
	panic("empty enum")
}

func (e StringEnum[T]) FromString(s string) T {
	for k, v := range e {
		if v == s {
			return k
		}
	}
	for k := range e {
		return k
	}
	panic("empty enum")
}
