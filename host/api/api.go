package api

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/burgrp/nano-m7/host/printer"
	"github.com/burgrp/nano-m7/host/store"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Handler struct {
	store   *store.Store
	printer *printer.Printer
	setup   *store.Setup
}

func New(st *store.Store, pr *printer.Printer, setup *store.Setup) http.Handler {
	h := &Handler{store: st, printer: pr, setup: setup}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Root
	r.Get("/", h.root)
	r.Get("/favicon.ico", http.NotFound)

	// Status
	r.Get("/status", h.status)
	r.Get("/json/index", h.jsonIndex)
	r.Get("/printer/stat", h.printerStat)

	// Database files (nanosupport polls machine.json for printer config)
	r.Get("/json/db/{file}", h.jsonDB)

	// Setup
	r.Get("/setup", h.getSetup)
	r.Post("/setup", h.postSetup)

	// Profiles
	r.Get("/profiles", h.listProfiles)
	r.Get("/profile/json/{id}", h.getProfile)
	r.Post("/profile/add", h.addProfile)
	r.Post("/profile/edit/{id}", h.editProfile)
	r.Get("/profile/delete/{id}", h.deleteProfile)

	// Plates
	r.Post("/plate/add", h.addPlate)
	r.Get("/plates/list/json", h.listPlates)
	r.Get("/plate/delete/{id}", h.deletePlate)
	r.Get("/plate/preview/{plateID}/{layerID}", h.layerPreview)

	// Print control
	r.Get("/printer/start/{plateID}", h.startPrint)
	r.Get("/printer/stop", h.stopPrint)
	r.Get("/printer/pause", h.pausePrint)
	r.Get("/printer/resume", h.resumePrint)

	// Projector (informational — actual display is driven by the printer loop)
	r.Get("/projector/on", h.projectorOn)
	r.Get("/projector/off", h.projectorOff)
	r.Get("/projector/blank", h.projectorBlank)
	r.Get("/projector/display/{image}", h.projectorDisplay)

	// Z-axis
	r.Get("/z-axis/info", h.zAxisInfo)
	r.Get("/z-axis/move/{direction}/{type}/{amount}", h.zAxisMove)
	r.Get("/z-axis/bottom", h.zAxisBottom)

	return r
}

// --- helpers ---

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "data": v})
}

func jsonErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "message": msg})
}

// --- root ---

func (h *Handler) root(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprintf(w, `<!DOCTYPE html><html><body><h1>%s</h1><p><a href="/printer/stat">/printer/stat</a></p></body></html>`, h.setup.Name)
}

// --- database files ---

// jsonDB serves NanoDLP-style database JSON files.
// NanoSupport polls machine.json to read printer configuration.
func (h *Handler) jsonDB(w http.ResponseWriter, r *http.Request) {
	file := chi.URLParam(r, "file")
	switch file {
	case "machine.json":
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(h.machineJSON())
	case "profiles.json":
		profiles, err := h.store.ListProfiles()
		if err != nil {
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(profiles)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handler) machineJSON() map[string]any {
	st := h.printer.GetState()
	return map[string]any{
		"ID":           1,
		"Name":         h.setup.Name,
		"PrinterModel": h.setup.PrinterModel,
		// physical build volume (derived)
		"XSize": h.setup.XSizeMM(),
		"YSize": h.setup.YSizeMM(),
		"ZSize": h.setup.ZSize,
		// projector / display
		"XResolution": h.setup.XResolution,
		"YResolution": h.setup.YResolution,
		"PixelSizeX":  h.setup.PixelSizeX,
		"PixelSizeY":  h.setup.PixelSizeY,
		// z motion defaults
		"StepsPerMM":   h.setup.StepsPerMM,
		"LiftHeight":   h.setup.LiftHeight,
		"LiftSpeed":    h.setup.LiftSpeed,
		"RetractSpeed": h.setup.RetractSpeed,
		// printer state
		"Status":       st.Status,
		"CurrentLayer": st.CurrentLayer,
		"TotalLayers":  st.TotalLayers,
		"PlateID":      st.PlateID,
		"ZPosition":    float64(st.ZSteps) / h.setup.StepsPerMM,
	}
}

// --- status ---

func (h *Handler) status(w http.ResponseWriter, r *http.Request) {
	st := h.printer.GetState()
	jsonOK(w, map[string]any{
		"Status":       st.Status,
		"CurrentLayer": st.CurrentLayer,
		"TotalLayers":  st.TotalLayers,
		"PlateID":      st.PlateID,
		"ZPosition":    float64(st.ZSteps) / h.setup.StepsPerMM,
	})
}

func (h *Handler) jsonIndex(w http.ResponseWriter, r *http.Request) {
	st := h.printer.GetState()
	jsonOK(w, map[string]any{
		"Status":       st.Status,
		"CurrentLayer": st.CurrentLayer,
		"TotalLayers":  st.TotalLayers,
		"PlateID":      st.PlateID,
		"ZSteps":       st.ZSteps,
		"LampTempC":    st.LampTempC,
	})
}

func (h *Handler) printerStat(w http.ResponseWriter, r *http.Request) {
	st := h.printer.GetState()
	jsonOK(w, map[string]any{
		"Status":       st.Status,
		"CurrentLayer": st.CurrentLayer,
		"TotalLayers":  st.TotalLayers,
		"PlateID":      st.PlateID,
		"ZSteps":       st.ZSteps,
		"EndStop":      st.EndStop,
		"LampTempC":    st.LampTempC,
		"Error":        st.Error,
	})
}

// --- setup ---

func (h *Handler) getSetup(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, h.setup)
}

func (h *Handler) postSetup(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	field := func(name string) string { return r.FormValue(name) }
	fieldF := func(name string, cur float64) float64 {
		if s := field(name); s != "" {
			if v, err := strconv.ParseFloat(s, 64); err == nil {
				return v
			}
		}
		return cur
	}
	fieldI := func(name string, cur int) int {
		if s := field(name); s != "" {
			if v, err := strconv.Atoi(s); err == nil {
				return v
			}
		}
		return cur
	}
	if v := field("Name"); v != "" {
		h.setup.Name = v
	}
	h.setup.ZSize = fieldF("ZSize", h.setup.ZSize)
	h.setup.XResolution = fieldI("XResolution", h.setup.XResolution)
	h.setup.YResolution = fieldI("YResolution", h.setup.YResolution)
	h.setup.PixelSizeX = fieldF("PixelSizeX", h.setup.PixelSizeX)
	h.setup.PixelSizeY = fieldF("PixelSizeY", h.setup.PixelSizeY)
	h.setup.StepsPerMM = fieldF("StepsPerMM", h.setup.StepsPerMM)
	h.setup.LiftHeight = fieldF("LiftHeight", h.setup.LiftHeight)
	h.setup.LiftSpeed = fieldF("LiftSpeed", h.setup.LiftSpeed)
	h.setup.RetractSpeed = fieldF("RetractSpeed", h.setup.RetractSpeed)

	if err := h.store.SaveSetup(h.setup); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonOK(w, h.setup)
}

// --- profiles ---

func (h *Handler) listProfiles(w http.ResponseWriter, r *http.Request) {
	profiles, err := h.store.ListProfiles()
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonOK(w, profiles)
}

func (h *Handler) getProfile(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	p, err := h.store.GetProfile(id)
	if err != nil {
		jsonErr(w, http.StatusNotFound, err.Error())
		return
	}
	jsonOK(w, p)
}

func (h *Handler) addProfile(w http.ResponseWriter, r *http.Request) {
	p, err := h.profileFromForm(r, nil)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	// assign next ID
	profiles, _ := h.store.ListProfiles()
	maxID := 0
	for _, existing := range profiles {
		if existing.ID > maxID {
			maxID = existing.ID
		}
	}
	p.ID = maxID + 1
	if err := h.store.SaveProfile(p); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonOK(w, p)
}

func (h *Handler) editProfile(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	existing, err := h.store.GetProfile(id)
	if err != nil {
		jsonErr(w, http.StatusNotFound, err.Error())
		return
	}
	p, err := h.profileFromForm(r, existing)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	p.ID = id
	if err := h.store.SaveProfile(p); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonOK(w, p)
}

func (h *Handler) deleteProfile(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.store.DeleteProfile(id); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonOK(w, nil)
}

// profileFromForm builds a Profile from a multipart form, merging with base if provided.
func (h *Handler) profileFromForm(r *http.Request, base *store.Profile) (*store.Profile, error) {
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		return nil, err
	}
	if base == nil {
		base = &store.Profile{}
	}
	fStr := func(name string, cur string) string {
		if v := r.FormValue(name); v != "" {
			return v
		}
		return cur
	}
	fF := func(name string, cur float64) float64 {
		if v := r.FormValue(name); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				return f
			}
		}
		return cur
	}
	fI := func(name string, cur int) int {
		if v := r.FormValue(name); v != "" {
			if i, err := strconv.Atoi(v); err == nil {
				return i
			}
		}
		return cur
	}
	return &store.Profile{
		Name:               fStr("Name", base.Name),
		Description:        fStr("Description", base.Description),
		XResolution:        fI("XResolution", base.XResolution),
		YResolution:        fI("YResolution", base.YResolution),
		PixelSizeX:         fF("PixelSizeX", base.PixelSizeX),
		PixelSizeY:         fF("PixelSizeY", base.PixelSizeY),
		LayerThicknessMM:   fF("LayerThicknessMM", base.LayerThicknessMM),
		ExposureTime:       fF("ExposureTime", base.ExposureTime),
		BottomExposureTime: fF("BottomExposureTime", base.BottomExposureTime),
		BottomLayers:       fI("BottomLayers", base.BottomLayers),
		LiftDistance:       fF("LiftDistance", base.LiftDistance),
		LiftSpeed:          fF("LiftSpeed", base.LiftSpeed),
		RetractSpeed:       fF("RetractSpeed", base.RetractSpeed),
	}, nil
}

// --- plates ---

// addPlate accepts a multipart upload. The file may be:
//   - a zip archive containing layer PNGs (named 1.png … N.png) and optionally a plate.json
//   - a single PNG (treated as a single-layer plate for testing)
func (h *Handler) addPlate(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(500 << 20); err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}

	f, fh, err := r.FormFile("file")
	if err != nil {
		jsonErr(w, http.StatusBadRequest, "file field required")
		return
	}
	defer f.Close()

	id, err := h.store.NextPlateID()
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	name := r.FormValue("name")
	if name == "" {
		name = strings.TrimSuffix(fh.Filename, filepath.Ext(fh.Filename))
	}

	plate := &store.Plate{
		ID:        id,
		Name:      name,
		CreatedAt: time.Now(),
	}

	// parse optional metadata from form
	if v := r.FormValue("profileID"); v != "" {
		plate.ProfileID, _ = strconv.Atoi(v)
	}

	layersDir := h.store.LayersDir(id)
	if err := os.MkdirAll(layersDir, 0755); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	// read file into a temp buffer for zip detection
	tmp, err := os.CreateTemp("", "plate-*.zip")
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()

	size, err := io.Copy(tmp, f)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	tmp.Seek(0, io.SeekStart)

	zr, err := zip.NewReader(tmp, size)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, "uploaded file is not a valid zip: "+err.Error())
		return
	}

	totalLayers, err := extractPlateZip(zr, layersDir, plate)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	plate.TotalLayers = totalLayers

	if err := h.store.SavePlate(plate); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	log.Printf("plate %d %q added: %d layers", plate.ID, plate.Name, plate.TotalLayers)
	jsonOK(w, plate)
}

// extractPlateZip unpacks layer PNGs and an optional plate.json from a zip.
// Layer files must be named <number>.png (e.g. "1.png", "0001.png").
// Returns the total number of layer files found.
func extractPlateZip(zr *zip.Reader, layersDir string, plate *store.Plate) (int, error) {
	count := 0
	for _, zf := range zr.File {
		base := filepath.Base(zf.Name)

		if base == "plate.json" {
			if err := readZipJSON(zf, plate); err != nil {
				log.Printf("plate.json parse error: %v", err)
			}
			continue
		}

		if strings.ToLower(filepath.Ext(base)) != ".png" {
			continue
		}
		numStr := strings.TrimSuffix(base, filepath.Ext(base))
		layerNum, err := strconv.Atoi(strings.TrimLeft(numStr, "0"))
		if err != nil {
			continue
		}
		if layerNum == 0 {
			layerNum = 1
		}

		dst, err := os.Create(filepath.Join(layersDir, fmt.Sprintf("%d.png", layerNum)))
		if err != nil {
			return 0, err
		}
		rc, err := zf.Open()
		if err != nil {
			dst.Close()
			return 0, err
		}
		_, err = io.Copy(dst, rc)
		rc.Close()
		dst.Close()
		if err != nil {
			return 0, err
		}
		count++
	}
	return count, nil
}

func readZipJSON(zf *zip.File, v any) error {
	rc, err := zf.Open()
	if err != nil {
		return err
	}
	defer rc.Close()
	return json.NewDecoder(rc).Decode(v)
}

func (h *Handler) listPlates(w http.ResponseWriter, r *http.Request) {
	plates, err := h.store.ListPlates()
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(plates)
}

func (h *Handler) deletePlate(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.store.DeletePlate(id); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonOK(w, nil)
}

func (h *Handler) layerPreview(w http.ResponseWriter, r *http.Request) {
	plateID, err := strconv.Atoi(chi.URLParam(r, "plateID"))
	if err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid plateID")
		return
	}
	layerID, err := strconv.Atoi(chi.URLParam(r, "layerID"))
	if err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid layerID")
		return
	}
	path := h.store.LayerPath(plateID, layerID)
	http.ServeFile(w, r, path)
}

// --- print control ---

func (h *Handler) startPrint(w http.ResponseWriter, r *http.Request) {
	plateID, err := strconv.Atoi(chi.URLParam(r, "plateID"))
	if err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid plateID")
		return
	}

	plate, err := h.store.GetPlate(plateID)
	if err != nil {
		jsonErr(w, http.StatusNotFound, err.Error())
		return
	}

	// load profile for motion settings
	var prof *store.Profile
	if plate.ProfileID > 0 {
		prof, _ = h.store.GetProfile(plate.ProfileID)
	}

	job := printer.Job{
		PlateID:            plate.ID,
		TotalLayers:        plate.TotalLayers,
		LayerThicknessMM:   plate.LayerThicknessMM,
		ExposureTime:       plate.ExposureTime,
		BottomExposureTime: plate.BottomExposureTime,
		BottomLayers:       plate.BottomLayers,
		StepsPerMM:         h.setup.StepsPerMM,
		LiftDistanceMM:     5,
		LiftSpeedHz:        200,
		RetractSpeedHz:     400,
	}
	if prof != nil {
		job.LayerThicknessMM = prof.LayerThicknessMM
		job.ExposureTime = prof.ExposureTime
		job.BottomExposureTime = prof.BottomExposureTime
		job.BottomLayers = prof.BottomLayers
		job.LiftDistanceMM = prof.LiftDistance
		job.LiftSpeedHz = int(prof.LiftSpeed * h.setup.StepsPerMM)
		job.RetractSpeedHz = int(prof.RetractSpeed * h.setup.StepsPerMM)
	}

	if err := h.printer.Start(job); err != nil {
		jsonErr(w, http.StatusConflict, err.Error())
		return
	}
	jsonOK(w, nil)
}

func (h *Handler) stopPrint(w http.ResponseWriter, r *http.Request) {
	if err := h.printer.Stop(); err != nil {
		jsonErr(w, http.StatusConflict, err.Error())
		return
	}
	jsonOK(w, nil)
}

func (h *Handler) pausePrint(w http.ResponseWriter, r *http.Request) {
	if err := h.printer.Pause(); err != nil {
		jsonErr(w, http.StatusConflict, err.Error())
		return
	}
	jsonOK(w, nil)
}

func (h *Handler) resumePrint(w http.ResponseWriter, r *http.Request) {
	if err := h.printer.Resume(); err != nil {
		jsonErr(w, http.StatusConflict, err.Error())
		return
	}
	jsonOK(w, nil)
}

// --- projector ---

func (h *Handler) projectorOn(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, nil) // lamp is controlled by the printer loop
}

func (h *Handler) projectorOff(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, nil)
}

func (h *Handler) projectorBlank(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, nil)
}

func (h *Handler) projectorDisplay(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, nil)
}

// --- z-axis ---

func (h *Handler) zAxisInfo(w http.ResponseWriter, r *http.Request) {
	st := h.printer.GetState()
	positionMM := float64(st.ZSteps) / h.setup.StepsPerMM
	jsonOK(w, map[string]any{
		"PositionMM":    positionMM,
		"PositionSteps": st.ZSteps,
		"EndStop":       st.EndStop,
	})
}

func (h *Handler) zAxisMove(w http.ResponseWriter, r *http.Request) {
	direction := chi.URLParam(r, "direction") // "up" or "down"
	moveType := chi.URLParam(r, "type")        // "distance" or "steps"
	amountStr := chi.URLParam(r, "amount")

	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid amount")
		return
	}

	steps := int(amount)
	if moveType == "distance" {
		steps = int(amount * h.setup.StepsPerMM)
	}
	if direction == "down" {
		steps = -steps
	}

	if _, err := h.printer.SendSerial(fmt.Sprintf("ZM S%d F200", steps)); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonOK(w, nil)
}

func (h *Handler) zAxisBottom(w http.ResponseWriter, r *http.Request) {
	if _, err := h.printer.SendSerial("ZH"); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonOK(w, nil)
}
