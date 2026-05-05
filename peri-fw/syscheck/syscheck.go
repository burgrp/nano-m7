package syscheck

import (
	"machine"
	"runtime"
	"strconv"
	"time"

	"github.com/burgrp/nano-m7/fw/line"
)

type SysCheck struct {
	interval time.Duration
}

func NewSysCheck(pinLed machine.Pin, writer line.Writer) *SysCheck {

	s := &SysCheck{
		interval: 10000 * time.Millisecond,
	}

	pinLed.Configure(machine.PinConfig{Mode: machine.PinOutput})

	go func() {
		for {
			time.Sleep(s.interval)
			pinLed.Set(!pinLed.Get())

			var m runtime.MemStats
			runtime.ReadMemStats(&m)
			_ = writer.Write("; Alloc=" + strconv.Itoa(int(m.Alloc)) + " Sys=" + strconv.Itoa(int(m.Sys)) + " Mallocs=" + strconv.Itoa(int(m.Mallocs)))
		}
	}()

	return s
}

func (s *SysCheck) SetInterval(interval time.Duration) {
	s.interval = interval
}
