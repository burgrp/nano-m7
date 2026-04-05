package gcode

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/burgrp/nano-m7/fw/line"
)

type Commands map[string]func(args map[string]int) (string, error)

func Handle(reader line.Reader, writer line.Writer, commands Commands) error {
	for {
		ln, err := reader.Read()
		if err != nil {
			println("Error reading:", err.Error())
			time.Sleep(1 * time.Second)
			continue
		}

		// Strip inline comment
		if idx := strings.IndexByte(ln, ';'); idx >= 0 {
			ln = ln[:idx]
		}

		ln = strings.TrimSpace(ln)
		if ln == "" {
			continue
		}

		cmd, args, err := parseLine(ln)
		if err != nil {
			_ = writer.Write("error: " + err.Error())
			continue
		}

		handler, ok := commands[cmd]
		if !ok {
			_ = writer.Write("error: unknown command " + cmd)
			continue
		}

		result, err := handler(args)
		if err != nil {
			_ = writer.Write("error: " + err.Error())
			continue
		}

		response := "ok"
		if result != "" {
			response = "ok " + result
		}

		if writeErr := writer.Write(response); writeErr != nil {
			println("Error writing:", writeErr.Error())
		}
	}
}

// parseLine parses a GCode line into a command name and its arguments.
// The command is the first token (e.g. "G0", "M104").
// Each subsequent token must be a single uppercase letter followed by an integer (e.g. "X10", "S200").
func parseLine(s string) (string, map[string]int, error) {
	tokens := strings.Fields(s)
	if len(tokens) == 0 {
		return "", nil, errors.New("empty line")
	}

	cmd := strings.ToUpper(tokens[0])
	if !isValidCommand(cmd) {
		return "", nil, errors.New("invalid command: " + tokens[0])
	}

	args := map[string]int{}
	for _, tok := range tokens[1:] {
		tok = strings.ToUpper(tok)
		if len(tok) < 2 || tok[0] < 'A' || tok[0] > 'Z' {
			return "", nil, errors.New("invalid argument: " + tok)
		}
		val, err := strconv.Atoi(tok[1:])
		if err != nil {
			return "", nil, errors.New("invalid argument value: " + tok)
		}
		args[string(tok[0])] = val
	}

	return cmd, args, nil
}

// isValidCommand checks that the token starts with one or more letters followed by one or more digits.
func isValidCommand(s string) bool {
	i := 0
	for i < len(s) && s[i] >= 'A' && s[i] <= 'Z' {
		i++
	}
	if i == 0 || i == len(s) {
		return false
	}
	for ; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}
