package gcode

import (
	"time"

	"github.com/burgrp/nano-m7/fw/line"
)

func Handle(reader line.Reader, writer line.Writer) error {
	for {
		line, err := reader.Read()
		if err != nil {
			println("Error reading:", err.Error())
			time.Sleep(1 * time.Second)
			continue
		}
		if line != "" {
			err = writer.Write("Echo: " + line)
			if err != nil {
				println("Error writing:", err.Error())
			}
		}
	}
}
