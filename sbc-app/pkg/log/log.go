package log

import (
	"fmt"
	"os"
)

type Level int

const (
	DEBUG Level = iota
	INFO
	WARN
	ERROR
)

var minLevel = INFO

func Log(level Level, format string, a ...any) {
	if level >= minLevel {
		println(fmt.Sprintf(format, a...))
	}
}

func Debug(format string, a ...any) {
	Log(DEBUG, format, a...)
}

func Info(format string, a ...any) {
	Log(INFO, format, a...)
}

func Warn(format string, a ...any) {
	Log(WARN, format, a...)
}

func Error(format string, a ...any) {
	Log(ERROR, format, a...)
}

func init() {
	l := os.Getenv("LOG_LEVEL")
	switch l {
	case "debug":
		minLevel = DEBUG
	case "info":
		minLevel = INFO
	case "warn":
		minLevel = WARN
	case "error":
		minLevel = ERROR
	case "":
		minLevel = INFO
	default:
		panic("invalid log level '" + l + "', expected one of 'debug', 'info', 'warn', 'error'")
	}
}
