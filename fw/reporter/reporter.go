package report

import (
	"strconv"
)

type FrontPanelReporter interface {
	GetFrontPanelButton() bool
}

type LampReporter interface {
	GetLampTempC() int
}

type ZAxisReporter interface {
	GetZPositionMm() int
	GetEndStop() bool
}

type Reporter struct {
	frontPanelReporter FrontPanelReporter
	lampReporter       LampReporter
	zAxisReporter      ZAxisReporter
}

func NewReporter(frontPanelReporter FrontPanelReporter, lampReporter LampReporter, zAxisReporter ZAxisReporter) *Reporter {
	return &Reporter{
		frontPanelReporter: frontPanelReporter,
		lampReporter:       lampReporter,
		zAxisReporter:      zAxisReporter,
	}
}

func (r *Reporter) Report() (string, error) {
	zPositionMm := r.zAxisReporter.GetZPositionMm()
	zEndStop := r.zAxisReporter.GetEndStop()
	fpButton := r.frontPanelReporter.GetFrontPanelButton()
	lampTempC := r.lampReporter.GetLampTempC()

	return "Z:" + strconv.Itoa(zPositionMm) + " ES:" + strconv.Itoa(boolToInt(zEndStop)) + " BTN:" + strconv.Itoa(boolToInt(fpButton)) + " NTC:" + strconv.Itoa(lampTempC), nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
