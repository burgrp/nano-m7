package printer

import (
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"
)

type Status string

const (
	StatusIdle     Status = "Idle"
	StatusPrinting Status = "Printing"
	StatusPaused   Status = "Paused"
	StatusDone     Status = "Done"
	StatusError    Status = "Error"
)

// Serial is the subset of serial.Client used by the printer.
type Serial interface {
	Send(cmd string) (string, error)
	Status() (map[string]string, error)
}

// Display is the subset of display.Display used by the printer.
type Display interface {
	Show(pngPath string) error
	Blank()
}

// LayerProvider returns the file path for layer n (1-based) of a plate.
type LayerProvider func(plateID, layer int) string

type State struct {
	Status       Status
	PlateID      int
	CurrentLayer int
	TotalLayers  int
	ZSteps       int
	EndStop      bool
	LampTempC    int
	Error        string
}

type Job struct {
	PlateID            int
	TotalLayers        int
	LayerThicknessMM   float64
	ExposureTime       float64 // seconds
	BottomExposureTime float64 // seconds
	BottomLayers       int
	LiftDistanceMM     float64 // mm
	LiftSpeedHz        int     // steps/s
	RetractSpeedHz     int     // steps/s
	StepsPerMM         float64
}

type Printer struct {
	serial   Serial
	display  Display
	layerFor LayerProvider

	mu       sync.RWMutex
	state    State
	pauseCh  chan struct{}
	resumeCh chan struct{}
	stopCh   chan struct{}
}

func New(ser Serial, disp Display, layerFor LayerProvider) *Printer {
	return &Printer{
		serial:   ser,
		display:  disp,
		layerFor: layerFor,
		state:    State{Status: StatusIdle},
	}
}

func (p *Printer) GetState() State {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.state
}

func (p *Printer) Start(job Job) error {
	p.mu.Lock()
	if p.state.Status == StatusPrinting || p.state.Status == StatusPaused {
		p.mu.Unlock()
		return fmt.Errorf("printer busy")
	}
	p.state = State{Status: StatusPrinting, PlateID: job.PlateID, TotalLayers: job.TotalLayers}
	p.pauseCh = make(chan struct{}, 1)
	p.resumeCh = make(chan struct{}, 1)
	p.stopCh = make(chan struct{}, 1)
	p.mu.Unlock()

	go p.run(job)
	return nil
}

func (p *Printer) Pause() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.state.Status != StatusPrinting {
		return fmt.Errorf("not printing")
	}
	p.state.Status = StatusPaused
	select {
	case p.pauseCh <- struct{}{}:
	default:
	}
	return nil
}

func (p *Printer) Resume() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.state.Status != StatusPaused {
		return fmt.Errorf("not paused")
	}
	p.state.Status = StatusPrinting
	select {
	case p.resumeCh <- struct{}{}:
	default:
	}
	return nil
}

func (p *Printer) Stop() error {
	p.mu.Lock()
	status := p.state.Status
	p.mu.Unlock()
	if status != StatusPrinting && status != StatusPaused {
		return fmt.Errorf("not printing")
	}
	select {
	case p.stopCh <- struct{}{}:
	default:
	}
	return nil
}

func (p *Printer) run(job Job) {
	defer func() {
		p.display.Blank()
		if r := recover(); r != nil {
			p.setError(fmt.Sprintf("panic: %v", r))
		}
	}()

	if err := p.home(); err != nil {
		p.setError(err.Error())
		return
	}

	for layer := 1; layer <= job.TotalLayers; layer++ {
		// check stop
		select {
		case <-p.stopCh:
			p.setState(StatusIdle, layer)
			return
		default:
		}

		// wait if paused
		select {
		case <-p.pauseCh:
			<-p.resumeCh
		default:
		}

		// check stop again after resume
		select {
		case <-p.stopCh:
			p.setState(StatusIdle, layer)
			return
		default:
		}

		p.mu.Lock()
		p.state.CurrentLayer = layer
		p.mu.Unlock()

		// move to layer position
		targetSteps := int(float64(layer) * job.LayerThicknessMM * job.StepsPerMM)
		if err := p.moveAbsolute(targetSteps, job.LiftDistanceMM, job.LiftSpeedHz, job.RetractSpeedHz, job.StepsPerMM); err != nil {
			p.setError(err.Error())
			return
		}

		// display layer
		layerPath := p.layerFor(job.PlateID, layer)
		if err := p.display.Show(layerPath); err != nil {
			log.Printf("display layer %d: %v", layer, err)
		}

		// exposure
		exposure := job.ExposureTime
		if layer <= job.BottomLayers {
			exposure = job.BottomExposureTime
		}
		if err := p.lampOn(); err != nil {
			log.Printf("lamp on: %v", err)
		}
		time.Sleep(time.Duration(float64(time.Second) * exposure))
		if err := p.lampOff(); err != nil {
			log.Printf("lamp off: %v", err)
		}

		p.display.Blank()
		p.syncStatus()
	}

	p.setState(StatusDone, job.TotalLayers)
}

func (p *Printer) home() error {
	_, err := p.serial.Send("ZH")
	return err
}

// moveAbsolute lifts to targetSteps+liftMM, then retracts back to targetSteps.
func (p *Printer) moveAbsolute(targetSteps int, liftMM float64, liftHz, retractHz int, stepsPerMM float64) error {
	liftSteps := int(liftMM * stepsPerMM)
	peakSteps := targetSteps + liftSteps

	current := p.currentSteps()

	// lift
	delta := peakSteps - current
	if delta != 0 {
		if _, err := p.serial.Send(fmt.Sprintf("ZM S%d F%d", delta, liftHz)); err != nil {
			return err
		}
	}

	// retract to target
	retract := targetSteps - peakSteps
	if retract != 0 {
		if _, err := p.serial.Send(fmt.Sprintf("ZM S%d F%d", retract, retractHz)); err != nil {
			return err
		}
	}

	p.mu.Lock()
	p.state.ZSteps = targetSteps
	p.mu.Unlock()
	return nil
}

func (p *Printer) lampOn() error {
	if _, err := p.serial.Send("LPE"); err != nil {
		return err
	}
	_, err := p.serial.Send("LFE")
	return err
}

func (p *Printer) lampOff() error {
	if _, err := p.serial.Send("LPD"); err != nil {
		return err
	}
	_, err := p.serial.Send("LFD")
	return err
}

func (p *Printer) syncStatus() {
	fields, err := p.serial.Status()
	if err != nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if v, ok := fields["Z"]; ok {
		p.state.ZSteps, _ = strconv.Atoi(v)
	}
	if v, ok := fields["ES"]; ok {
		p.state.EndStop = v == "1"
	}
	if v, ok := fields["NTC"]; ok {
		p.state.LampTempC, _ = strconv.Atoi(v)
	}
}

func (p *Printer) currentSteps() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.state.ZSteps
}

func (p *Printer) setState(status Status, layer int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.state.Status = status
	p.state.CurrentLayer = layer
}

// SendSerial sends a raw command to the IO board. Used by the API for manual moves.
func (p *Printer) SendSerial(cmd string) (string, error) {
	return p.serial.Send(cmd)
}

func (p *Printer) setError(msg string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.state.Status = StatusError
	p.state.Error = msg
	log.Printf("printer error: %s", msg)
}
