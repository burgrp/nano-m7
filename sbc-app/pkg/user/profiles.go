package user

// Default profile parameter values.
//
// Sources:
//   - Default* — Anycubic M7 summary parameter table (standard speed):
//     https://store.anycubic.com/blogs/news/resin-settings-for-anycubic-3d-printers
//   - DefaultAbs* — Anycubic dedicated ABS-Like resin guide (more conservative
//     than the summary; longer bottom exposure, more bottom layers, shorter
//     lift, slower retract):
//     https://store.anycubic.com/blogs/3d-printing-guides/anycubic-abs-like-resin-settings
const (
	DefaultLayerThicknessUm     = 50
	DefaultNormalExposureTimeMs = 1800
	DefaultBottomExposureTimeMs = 25000
	DefaultBottomLayerCount     = 3
	DefaultTransitionLayerCount = 6
	DefaultLiftDistanceUm       = 8000
	DefaultLiftSpeedUmPerMin    = 360000
	DefaultRetractSpeedUmPerMin = 360000
	DefaultRestAfterRetractMs   = 500

	DefaultAbsNormalExposureTimeMs = 2500
	DefaultAbsBottomExposureTimeMs = 40000
	DefaultAbsBottomLayerCount     = 6
	DefaultAbsLiftDistanceUm       = 6000
	DefaultAbsRetractSpeedUmPerMin = 240000
)

// DefaultProfiles returns the built-in profile catalog used when user
// settings contain no profiles. Returned map is freshly allocated, so
// callers may mutate it.
func DefaultProfiles() map[string]Profile {
	return map[string]Profile{
		// Dedicated ABS-Like guide — more conservative than the M7 summary
		// table (longer bottom exposure, more bottom layers, shorter lift,
		// slower retract).
		"anycubic_abs_like_plus": {
			Name:                 "Anycubic ABS-Like Resin+",
			LayerThicknessUm:     DefaultLayerThicknessUm,
			NormalExposureTimeMs: DefaultAbsNormalExposureTimeMs,
			BottomExposureTimeMs: DefaultAbsBottomExposureTimeMs,
			BottomLayerCount:     DefaultAbsBottomLayerCount,
			TransitionLayerCount: DefaultTransitionLayerCount,
			LiftDistanceUm:       DefaultAbsLiftDistanceUm,
			LiftSpeedUmPerMin:    DefaultLiftSpeedUmPerMin,
			RetractSpeedUmPerMin: DefaultAbsRetractSpeedUmPerMin,
			RestAfterRetractMs:   DefaultRestAfterRetractMs,
		},
		// No dedicated M7 guide for the Pro variant; mirrors ABS-Like+ as a
		// conservative starting point. Tune via calibration before relying.
		"anycubic_abs_like_pro": {
			Name:                 "Anycubic ABS-Like Resin Pro",
			LayerThicknessUm:     DefaultLayerThicknessUm,
			NormalExposureTimeMs: DefaultAbsNormalExposureTimeMs,
			BottomExposureTimeMs: DefaultAbsBottomExposureTimeMs,
			BottomLayerCount:     DefaultAbsBottomLayerCount,
			TransitionLayerCount: DefaultTransitionLayerCount,
			LiftDistanceUm:       DefaultAbsLiftDistanceUm,
			LiftSpeedUmPerMin:    DefaultLiftSpeedUmPerMin,
			RetractSpeedUmPerMin: DefaultAbsRetractSpeedUmPerMin,
			RestAfterRetractMs:   DefaultRestAfterRetractMs,
		},
		"anycubic_dlp_craftsman": {
			Name:                 "Anycubic DLP Craftsman Resin",
			LayerThicknessUm:     DefaultLayerThicknessUm,
			NormalExposureTimeMs: DefaultNormalExposureTimeMs,
			BottomExposureTimeMs: DefaultBottomExposureTimeMs,
			BottomLayerCount:     DefaultBottomLayerCount,
			TransitionLayerCount: DefaultTransitionLayerCount,
			LiftDistanceUm:       DefaultLiftDistanceUm,
			LiftSpeedUmPerMin:    DefaultLiftSpeedUmPerMin,
			RetractSpeedUmPerMin: DefaultRetractSpeedUmPerMin,
			RestAfterRetractMs:   DefaultRestAfterRetractMs,
		},
		"anycubic_plant_based": {
			Name:                 "Anycubic Plant-Based Resin",
			LayerThicknessUm:     DefaultLayerThicknessUm,
			NormalExposureTimeMs: DefaultNormalExposureTimeMs,
			BottomExposureTimeMs: DefaultBottomExposureTimeMs,
			BottomLayerCount:     DefaultBottomLayerCount,
			TransitionLayerCount: DefaultTransitionLayerCount,
			LiftDistanceUm:       DefaultLiftDistanceUm,
			LiftSpeedUmPerMin:    DefaultLiftSpeedUmPerMin,
			RetractSpeedUmPerMin: DefaultRetractSpeedUmPerMin,
			RestAfterRetractMs:   DefaultRestAfterRetractMs,
		},
		"anycubic_standard": {
			Name:                 "Anycubic Standard Resin",
			LayerThicknessUm:     DefaultLayerThicknessUm,
			NormalExposureTimeMs: DefaultNormalExposureTimeMs,
			BottomExposureTimeMs: DefaultBottomExposureTimeMs,
			BottomLayerCount:     DefaultBottomLayerCount,
			TransitionLayerCount: DefaultTransitionLayerCount,
			LiftDistanceUm:       DefaultLiftDistanceUm,
			LiftSpeedUmPerMin:    DefaultLiftSpeedUmPerMin,
			RetractSpeedUmPerMin: DefaultRetractSpeedUmPerMin,
			RestAfterRetractMs:   DefaultRestAfterRetractMs,
		},
		// Anycubic publishes identical values for V2 and the original Standard.
		"anycubic_standard_v2": {
			Name:                 "Anycubic Standard Resin V2",
			LayerThicknessUm:     DefaultLayerThicknessUm,
			NormalExposureTimeMs: DefaultNormalExposureTimeMs,
			BottomExposureTimeMs: DefaultBottomExposureTimeMs,
			BottomLayerCount:     DefaultBottomLayerCount,
			TransitionLayerCount: DefaultTransitionLayerCount,
			LiftDistanceUm:       DefaultLiftDistanceUm,
			LiftSpeedUmPerMin:    DefaultLiftSpeedUmPerMin,
			RetractSpeedUmPerMin: DefaultRetractSpeedUmPerMin,
			RestAfterRetractMs:   DefaultRestAfterRetractMs,
		},
		// Only resin in the M7 summary table with distinct values:
		// longer normal exposure and longer light-off time.
		"anycubic_uv_tough": {
			Name:                 "Anycubic UV Tough Resin",
			LayerThicknessUm:     DefaultLayerThicknessUm,
			NormalExposureTimeMs: 2100,
			BottomExposureTimeMs: DefaultBottomExposureTimeMs,
			BottomLayerCount:     DefaultBottomLayerCount,
			TransitionLayerCount: DefaultTransitionLayerCount,
			LiftDistanceUm:       DefaultLiftDistanceUm,
			LiftSpeedUmPerMin:    DefaultLiftSpeedUmPerMin,
			RetractSpeedUmPerMin: DefaultRetractSpeedUmPerMin,
			RestAfterRetractMs:   1000,
		},
		"anycubic_water_wash_plus": {
			Name:                 "Anycubic Water-Wash Resin+",
			LayerThicknessUm:     DefaultLayerThicknessUm,
			NormalExposureTimeMs: DefaultNormalExposureTimeMs,
			BottomExposureTimeMs: DefaultBottomExposureTimeMs,
			BottomLayerCount:     DefaultBottomLayerCount,
			TransitionLayerCount: DefaultTransitionLayerCount,
			LiftDistanceUm:       DefaultLiftDistanceUm,
			LiftSpeedUmPerMin:    DefaultLiftSpeedUmPerMin,
			RetractSpeedUmPerMin: DefaultRetractSpeedUmPerMin,
			RestAfterRetractMs:   DefaultRestAfterRetractMs,
		},
	}
}
