package user

type Profile struct {
	// Display name shown in the UI.
	Name string `yaml:"name"`
	// Layer thickness in micrometers (e.g. 50 = 0.05 mm).
	LayerThicknessUm int `yaml:"layer_thickness_um"`
	// Exposure time per normal layer, in milliseconds.
	NormalExposureTimeMs int `yaml:"normal_exposure_time_ms"`
	// Exposure time per bottom layer, in milliseconds.
	BottomExposureTimeMs int `yaml:"bottom_exposure_time_ms"`
	// Number of bottom layers using BottomExposureTimeMs.
	BottomLayerCount int `yaml:"bottom_layer_count"`
	// Number of transition layers fading from bottom to normal exposure.
	TransitionLayerCount int `yaml:"transition_layer_count"`
	// Z-axis lift distance after each layer, in micrometers.
	LiftDistanceUm int `yaml:"lift_distance_um"`
	// Z-axis lift (up) speed, in micrometers per minute.
	LiftSpeedUmPerMin int `yaml:"lift_speed_um_per_min"`
	// Z-axis retract (down) speed, in micrometers per minute.
	RetractSpeedUmPerMin int `yaml:"retract_speed_um_per_min"`
	// Settle delay after retract completes, before next exposure, in milliseconds.
	RestAfterRetractMs int `yaml:"rest_after_retract_ms"`
}

type Settings struct {
	PrinterName   string             `yaml:"printer_name" json:"printerName"`
	ActiveProfile string             `yaml:"active_profile" json:"activeProfile"`
	Profiles      map[string]Profile `yaml:"profiles" json:"profiles"`
}
