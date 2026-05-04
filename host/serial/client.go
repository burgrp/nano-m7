package serial

import (
	"bufio"
	"fmt"
	"strings"
	"sync"

	"go.bug.st/serial"
)

type Client struct {
	port    serial.Port
	scanner *bufio.Scanner
	mu      sync.Mutex
}

func New(path string, baud int) (*Client, error) {
	port, err := serial.Open(path, &serial.Mode{BaudRate: baud})
	if err != nil {
		return nil, fmt.Errorf("serial open %s: %w", path, err)
	}
	return &Client{
		port:    port,
		scanner: bufio.NewScanner(port),
	}, nil
}

// Send sends a GCode command and returns the response payload (the part after "ok ").
// Skips comment lines (starting with ";") until a response line is received.
func (c *Client) Send(cmd string) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, err := fmt.Fprintln(c.port, cmd); err != nil {
		return "", fmt.Errorf("serial write: %w", err)
	}

	for c.scanner.Scan() {
		line := strings.TrimSpace(c.scanner.Text())
		if line == "" || strings.HasPrefix(line, ";") {
			continue
		}
		if after, ok := strings.CutPrefix(line, "error:"); ok {
			return "", fmt.Errorf("firmware: %s", strings.TrimSpace(after))
		}
		if line == "ok" {
			return "", nil
		}
		if after, ok := strings.CutPrefix(line, "ok "); ok {
			return after, nil
		}
		// unexpected line — skip
	}

	if err := c.scanner.Err(); err != nil {
		return "", fmt.Errorf("serial read: %w", err)
	}
	return "", fmt.Errorf("serial: connection closed")
}

// Status parses a GET response into a map of key→value strings.
// GET response format: "Z:<steps> ES:<0|1> BTN:<0|1> NTC:<tempC>"
func (c *Client) Status() (map[string]string, error) {
	resp, err := c.Send("GET")
	if err != nil {
		return nil, err
	}
	result := map[string]string{}
	for _, field := range strings.Fields(resp) {
		k, v, ok := strings.Cut(field, ":")
		if ok {
			result[k] = v
		}
	}
	return result, nil
}

func (c *Client) Close() error {
	return c.port.Close()
}
