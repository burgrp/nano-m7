package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"sync"
	"time"
)

// Plate holds metadata for a sliced job uploaded by nanosupport.
type Plate struct {
	ID                 int       `json:"ID"`
	Name               string    `json:"Name"`
	TotalLayers        int       `json:"TotalLayers"`
	LayerThicknessMM   float64   `json:"LayerThicknessMM"`
	ExposureTime       float64   `json:"ExposureTime"`       // seconds
	BottomExposureTime float64   `json:"BottomExposureTime"` // seconds
	BottomLayers       int       `json:"BottomLayers"`
	ProfileID          int       `json:"ProfileID"`
	CreatedAt          time.Time `json:"CreatedAt"`
}

// Profile holds a print profile. Field names match NanoDLP's profile JSON format.
type Profile struct {
	ID                 int     `json:"ID"`
	Name               string  `json:"Name"`
	Description        string  `json:"Description"`
	XResolution        int     `json:"XResolution"`
	YResolution        int     `json:"YResolution"`
	PixelSizeX         float64 `json:"PixelSizeX"` // µm
	PixelSizeY         float64 `json:"PixelSizeY"` // µm
	LayerThicknessMM   float64 `json:"LayerThicknessMM"`
	ExposureTime       float64 `json:"ExposureTime"`       // seconds
	BottomExposureTime float64 `json:"BottomExposureTime"` // seconds
	BottomLayers       int     `json:"BottomLayers"`
	LiftDistance       float64 `json:"LiftDistance"` // mm
	LiftSpeed          float64 `json:"LiftSpeed"`    // mm/s
	RetractSpeed       float64 `json:"RetractSpeed"` // mm/s
}

// Setup holds persistent printer configuration.
type Setup struct {
	Name         string  `json:"Name"`
	XSizeMM      float64 `json:"XSizeMM"`
	YSizeMM      float64 `json:"YSizeMM"`
	ZSizeMM      float64 `json:"ZSizeMM"`
	XResolution  int     `json:"XResolution"`
	YResolution  int     `json:"YResolution"`
	StepsPerMM   float64 `json:"StepsPerMM"`
	SerialPort   string  `json:"SerialPort"`
	SerialBaud   int     `json:"SerialBaud"`
	Fullscreen   bool    `json:"Fullscreen"`
	WindowWidth  int     `json:"WindowWidth"`
	WindowHeight int     `json:"WindowHeight"`
}

type Store struct {
	root string
	mu   sync.RWMutex
}

func New(root string) (*Store, error) {
	for _, sub := range []string{"plates", "profiles"} {
		if err := os.MkdirAll(filepath.Join(root, sub), 0755); err != nil {
			return nil, err
		}
	}
	st := &Store{root: root}
	if err := st.ensureDefaultProfile(); err != nil {
		return nil, err
	}
	return st, nil
}

func (s *Store) ensureDefaultProfile() error {
	profiles, err := s.ListProfiles()
	if err != nil {
		return err
	}
	if len(profiles) > 0 {
		return nil
	}
	return s.SaveProfile(&Profile{
		ID:                 1,
		Name:               "Standard 0.05mm",
		Description:        "Default profile for DBM101M14K01 14K display",
		XResolution:        13320,
		YResolution:        5120,
		PixelSizeX:         16.8,
		PixelSizeY:         24.8,
		LayerThicknessMM:   0.05,
		ExposureTime:       8.0,
		BottomExposureTime: 30.0,
		BottomLayers:       5,
		LiftDistance:       5.0,
		LiftSpeed:          1.0,
		RetractSpeed:       2.0,
	})
}

// --- Setup ---

func (s *Store) LoadSetup() (*Setup, error) {
	setup := defaultSetup()
	data, err := os.ReadFile(filepath.Join(s.root, "setup.json"))
	if os.IsNotExist(err) {
		return setup, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(data, setup); err != nil {
		return nil, err
	}
	return setup, nil
}

func (s *Store) SaveSetup(setup *Setup) error {
	return writeJSON(filepath.Join(s.root, "setup.json"), setup)
}

func defaultSetup() *Setup {
	return &Setup{
		Name:         "NanoM7",
		XSizeMM:      223.78,
		YSizeMM:      126.98,
		ZSizeMM:      200,
		XResolution:  13320,
		YResolution:  5120,
		StepsPerMM:   400,
		SerialPort:   "/dev/ttyACM0",
		SerialBaud:   115200,
		Fullscreen:   false,
		WindowWidth:  1920,
		WindowHeight: 1080,
	}
}

// --- Profiles ---

func (s *Store) ListProfiles() ([]*Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries, err := os.ReadDir(filepath.Join(s.root, "profiles"))
	if err != nil {
		return nil, err
	}
	var profiles []*Profile
	for _, e := range entries {
		if filepath.Ext(e.Name()) != ".json" {
			continue
		}
		p, err := s.loadProfile(e.Name()[:len(e.Name())-5])
		if err == nil {
			profiles = append(profiles, p)
		}
	}
	return profiles, nil
}

func (s *Store) GetProfile(id int) (*Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.loadProfile(strconv.Itoa(id))
}

func (s *Store) SaveProfile(p *Profile) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return writeJSON(filepath.Join(s.root, "profiles", strconv.Itoa(p.ID)+".json"), p)
}

func (s *Store) DeleteProfile(id int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return os.Remove(filepath.Join(s.root, "profiles", strconv.Itoa(id)+".json"))
}

func (s *Store) loadProfile(id string) (*Profile, error) {
	data, err := os.ReadFile(filepath.Join(s.root, "profiles", id+".json"))
	if err != nil {
		return nil, err
	}
	var p Profile
	return &p, json.Unmarshal(data, &p)
}

// --- Plates ---

func (s *Store) ListPlates() ([]*Plate, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries, err := os.ReadDir(filepath.Join(s.root, "plates"))
	if err != nil {
		return nil, err
	}
	var plates []*Plate
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		id, err := strconv.Atoi(e.Name())
		if err != nil {
			continue
		}
		p, err := s.loadPlate(id)
		if err == nil {
			plates = append(plates, p)
		}
	}
	slices.SortFunc(plates, func(a, b *Plate) int { return b.ID - a.ID })
	return plates, nil
}

func (s *Store) GetPlate(id int) (*Plate, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.loadPlate(id)
}

func (s *Store) SavePlate(p *Plate) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	dir := filepath.Join(s.root, "plates", strconv.Itoa(p.ID))
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	return writeJSON(filepath.Join(dir, "plate.json"), p)
}

func (s *Store) DeletePlate(id int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return os.RemoveAll(filepath.Join(s.root, "plates", strconv.Itoa(id)))
}

func (s *Store) LayerPath(plateID, layer int) string {
	return filepath.Join(s.root, "plates", strconv.Itoa(plateID), "layers", fmt.Sprintf("%d.png", layer))
}

func (s *Store) LayersDir(plateID int) string {
	return filepath.Join(s.root, "plates", strconv.Itoa(plateID), "layers")
}

func (s *Store) NextPlateID() (int, error) {
	plates, err := s.ListPlates()
	if err != nil {
		return 0, err
	}
	max := 0
	for _, p := range plates {
		if p.ID > max {
			max = p.ID
		}
	}
	return max + 1, nil
}

func (s *Store) loadPlate(id int) (*Plate, error) {
	data, err := os.ReadFile(filepath.Join(s.root, "plates", strconv.Itoa(id), "plate.json"))
	if err != nil {
		return nil, err
	}
	var p Plate
	return &p, json.Unmarshal(data, &p)
}

func writeJSON(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
