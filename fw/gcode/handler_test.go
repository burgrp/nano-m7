package gcode

import (
	"errors"
	"testing"
)

// mockReader feeds a fixed sequence of lines and then blocks forever.
type mockReader struct {
	lines []string
	pos   int
	done  chan struct{}
}

func newMockReader(lines ...string) *mockReader {
	return &mockReader{lines: lines, done: make(chan struct{})}
}

func (r *mockReader) Read() (string, error) {
	if r.pos < len(r.lines) {
		l := r.lines[r.pos]
		r.pos++
		return l, nil
	}
	// Signal that all lines have been consumed, then block.
	select {
	case r.done <- struct{}{}:
	default:
	}
	// Block so Handle's loop waits; test will stop via channel.
	select {}
}

// mockWriter collects all written strings.
type mockWriter struct {
	lines []string
}

func (w *mockWriter) Write(s string) error {
	w.lines = append(w.lines, s)
	return nil
}

// runHandle runs Handle with the given inputs, collects exactly wantN responses, then returns them.
func runHandle(t *testing.T, cmds Commands, inputs ...string) []string {
	t.Helper()
	reader := newMockReader(inputs...)
	writer := &mockWriter{}

	done := make(chan struct{})
	go func() {
		Handle(reader, writer, cmds) //nolint
	}()

	// Wait until all input lines have been consumed.
	<-reader.done

	close(done)
	return writer.lines
}

var noopCommands = Commands{
	"G0": func(args map[string]int) (string, error) { return "", nil },
	"G1": func(args map[string]int) (string, error) { return "moved", nil },
	"M104": func(args map[string]int) (string, error) {
		s, ok := args["S"]
		if !ok {
			return "", errors.New("missing S argument")
		}
		return "temp=" + itoa(s), nil
	},
	"G28": func(args map[string]int) (string, error) { return "", errors.New("homing failed") },
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	buf := make([]byte, 0, 10)
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	if neg {
		buf = append([]byte{'-'}, buf...)
	}
	return string(buf)
}

func TestEmptyAndCommentLinesAreIgnored(t *testing.T) {
	got := runHandle(t, noopCommands, "", "   ", "; this is a comment", "  ; another")
	if len(got) != 0 {
		t.Errorf("expected no responses, got %v", got)
	}
}

func TestSimpleCommandOk(t *testing.T) {
	got := runHandle(t, noopCommands, "G0")
	if len(got) != 1 || got[0] != "ok" {
		t.Errorf("expected [ok], got %v", got)
	}
}

func TestCommandWithResult(t *testing.T) {
	got := runHandle(t, noopCommands, "G1")
	if len(got) != 1 || got[0] != "ok moved" {
		t.Errorf("expected [ok moved], got %v", got)
	}
}

func TestCommandWithArguments(t *testing.T) {
	var gotArgs map[string]int
	cmds := Commands{
		"G0": func(args map[string]int) (string, error) {
			gotArgs = args
			return "", nil
		},
	}
	runHandle(t, cmds, "G0 X10 Y-5 Z100")
	if gotArgs["X"] != 10 || gotArgs["Y"] != -5 || gotArgs["Z"] != 100 {
		t.Errorf("unexpected args: %v", gotArgs)
	}
}

func TestInlineCommentStripped(t *testing.T) {
	var gotArgs map[string]int
	cmds := Commands{
		"G0": func(args map[string]int) (string, error) {
			gotArgs = args
			return "", nil
		},
	}
	runHandle(t, cmds, "G0 X42 ; move to position")
	if gotArgs["X"] != 42 || len(gotArgs) != 1 {
		t.Errorf("unexpected args: %v", gotArgs)
	}
}

func TestCommandResultPassedToWriter(t *testing.T) {
	got := runHandle(t, noopCommands, "M104 S200")
	if len(got) != 1 || got[0] != "ok temp=200" {
		t.Errorf("expected [ok temp=200], got %v", got)
	}
}

func TestUnknownCommandReturnsError(t *testing.T) {
	got := runHandle(t, noopCommands, "G99")
	if len(got) != 1 || got[0] != "error: unknown command G99" {
		t.Errorf("expected unknown command error, got %v", got)
	}
}

func TestCommandHandlerErrorPropagated(t *testing.T) {
	got := runHandle(t, noopCommands, "G28")
	if len(got) != 1 || got[0] != "error: homing failed" {
		t.Errorf("expected homing error, got %v", got)
	}
}

func TestMissingArgProducesHandlerError(t *testing.T) {
	got := runHandle(t, noopCommands, "M104")
	if len(got) != 1 || got[0] != "error: missing S argument" {
		t.Errorf("expected missing S error, got %v", got)
	}
}

func TestInvalidArgumentFormat(t *testing.T) {
	got := runHandle(t, noopCommands, "G0 INVALID")
	if len(got) != 1 {
		t.Fatalf("expected 1 response, got %v", got)
	}
	if got[0] == "ok" {
		t.Errorf("expected error response, got ok")
	}
}

func TestCommandCaseInsensitive(t *testing.T) {
	got := runHandle(t, noopCommands, "g0 x10")
	if len(got) != 1 || got[0] != "ok" {
		t.Errorf("expected ok for lowercase command, got %v", got)
	}
}

func TestMultipleCommands(t *testing.T) {
	got := runHandle(t, noopCommands, "G0", "; skip", "G1", "G0")
	if len(got) != 3 {
		t.Fatalf("expected 3 responses, got %v", got)
	}
	if got[0] != "ok" || got[1] != "ok moved" || got[2] != "ok" {
		t.Errorf("unexpected responses: %v", got)
	}
}

// --- parseLine unit tests ---

func TestParseLineBasic(t *testing.T) {
	cmd, args, err := parseLine("G0 X10 Y20")
	if err != nil {
		t.Fatal(err)
	}
	if cmd != "G0" {
		t.Errorf("expected G0, got %s", cmd)
	}
	if args["X"] != 10 || args["Y"] != 20 {
		t.Errorf("unexpected args: %v", args)
	}
}

func TestParseLineNegativeArg(t *testing.T) {
	_, args, err := parseLine("G0 Z-15")
	if err != nil {
		t.Fatal(err)
	}
	if args["Z"] != -15 {
		t.Errorf("expected Z=-15, got %d", args["Z"])
	}
}

func TestParseLineNoArgs(t *testing.T) {
	cmd, args, err := parseLine("G28")
	if err != nil {
		t.Fatal(err)
	}
	if cmd != "G28" || len(args) != 0 {
		t.Errorf("unexpected result: %s %v", cmd, args)
	}
}

func TestParseLineInvalidCommand(t *testing.T) {
	_, _, err := parseLine("123 X10")
	if err == nil {
		t.Error("expected error for numeric-only command")
	}
}

func TestParseLineLetterOnlyCommand(t *testing.T) {
	_, _, err := parseLine("GO X10") // "GO" has no digit
	if err == nil {
		t.Error("expected error for letter-only command")
	}
}
