package main

import (
	"flag"
	"fmt"
	"image"
	"image/png"
	"log"
	"math"
	"os"
	"path/filepath"
	"runtime/pprof"
	"strings"

	"github.com/pburgr/nano-m7/slicer/mesh"
	"github.com/pburgr/nano-m7/slicer/output"
	"github.com/pburgr/nano-m7/slicer/slice"
	"github.com/pburgr/nano-m7/slicer/stl"
)

func main() {
	input       := flag.String("input", "", "STL file path (required, unless --test-pattern)")
	out         := flag.String("output", "", "Output path (default: <input>.zip or <input>_<layer>.png with --only)")
	layerUM     := flag.Float64("layer-um", 50, "Layer height in micrometers")
	widthMM     := flag.Float64("width-mm", 218.88, "Build area width in mm")
	heightMM    := flag.Float64("height-mm", 122.88, "Build area height in mm")
	pixelsX     := flag.Int("pixels-x", 13320, "Mono output image width in pixels")
	pixelsY     := flag.Int("pixels-y", 5120, "Mono output image height in pixels")
	workers     := flag.Int("workers", 0, "Parallel workers per layer (0 = all CPUs)")
	only        := flag.Int("only", -1, "Render only this layer index and save as PNG (for debugging)")
	hdmi        := flag.Bool("hdmi", true, "Encode output as HDMI color-packed format (3 mono px per RGB px)")
	testPattern := flag.Bool("test-pattern", false, "Write an HDMI channel test pattern PNG and exit")
	cpuprofile  := flag.String("cpuprofile", "", "Write CPU profile to file")
	flag.Parse()

	if *cpuprofile != "" {
		f, err := os.Create(*cpuprofile)
		if err != nil {
			log.Fatalf("create cpuprofile: %v", err)
		}
		defer f.Close()
		pprof.StartCPUProfile(f)
		defer pprof.StopCPUProfile()
	}

	if *testPattern {
		dstW, h := output.HDMISize(*pixelsX, *pixelsY)
		outPath := *out
		if outPath == "" {
			outPath = "hdmi_test.png"
		}
		writePNG(output.TestPatternHDMI(dstW, h), outPath)
		fmt.Printf("wrote %s  (%dx%d HDMI → %dx%d mono)\n", outPath, dstW, h, *pixelsX, *pixelsY)
		fmt.Println("Expected on display: left third white, middle third white, right third white.")
		fmt.Println("If bands appear in wrong positions, swap R↔B in output/hdmi.go.")
		return
	}

	if *input == "" {
		flag.Usage()
		os.Exit(1)
	}

	log.Printf("loading %s", *input)
	m, err := stl.ParseFile(*input)
	if err != nil {
		log.Fatalf("parse STL: %v", err)
	}
	log.Printf("loaded %d triangles, bounds Z %.3f–%.3f mm",
		len(m.Triangles), m.Bounds.Min.Z, m.Bounds.Max.Z)

	p := slice.Printer{
		PixelsX:  *pixelsX,
		PixelsY:  *pixelsY,
		WidthMM:  *widthMM,
		HeightMM: *heightMM,
	}
	layerMM := *layerUM / 1000.0
	numLayers := int(math.Ceil(m.Bounds.Size().Z / layerMM))

	hdmiW, _ := output.HDMISize(*pixelsX, *pixelsY)
	if *hdmi {
		log.Printf("%d layers at %.1f µm → HDMI %dx%d px (mono %dx%d) / %.1fx%.1f mm",
			numLayers, *layerUM, hdmiW, *pixelsY, *pixelsX, *pixelsY, *widthMM, *heightMM)
	} else {
		log.Printf("%d layers at %.1f µm → %dx%d px / %.1fx%.1f mm",
			numLayers, *layerUM, *pixelsX, *pixelsY, *widthMM, *heightMM)
	}

	if *only >= 0 {
		renderOne(m, p, layerMM, *workers, *only, numLayers, *input, *out, *hdmi)
	} else {
		renderAll(m, p, layerMM, *workers, numLayers, *input, *out, *hdmi)
	}
}

func renderOne(m *mesh.Mesh, p slice.Printer, layerMM float64, workers, layerIdx, numLayers int, input, outPath string, hdmi bool) {
	if layerIdx >= numLayers {
		log.Fatalf("--only=%d out of range (0–%d)", layerIdx, numLayers-1)
	}

	z := m.Bounds.Min.Z + (float64(layerIdx)+0.5)*layerMM
	log.Printf("rendering layer %d / %d  (z=%.4f mm)", layerIdx, numLayers-1, z)

	contours := slice.SliceAt(m, z)
	gray := slice.Rasterize(contours, p, m.Bounds, workers)

	if outPath == "" {
		base := strings.TrimSuffix(filepath.Base(input), filepath.Ext(input))
		outPath = fmt.Sprintf("%s_%04d.png", base, layerIdx)
	}

	if hdmi {
		writePNG(output.GrayToHDMI(gray), outPath)
	} else {
		writePNG(gray, outPath)
	}
	fmt.Printf("wrote %s\n", outPath)
}

func renderAll(m *mesh.Mesh, p slice.Printer, layerMM float64, workers, numLayers int, input, outPath string, hdmi bool) {
	if outPath == "" {
		base := strings.TrimSuffix(filepath.Base(input), filepath.Ext(input))
		outPath = base + ".zip"
	}

	zw, err := output.OpenZIP(outPath)
	if err != nil {
		log.Fatalf("open output: %v", err)
	}
	// GrayToHDMI is applied inside ZIPWriter.AddSlice when hdmi=true.
	// For hdmi=false we need a raw writer — handled via the hdmi flag below.
	zw.SetHDMI(hdmi)

	written := 0
	if err := slice.GenerateAll(m, p, layerMM, workers, func(i int, img *image.Gray) error {
		written++
		if written%50 == 0 {
			log.Printf("  layer %d / %d", written, numLayers)
		}
		return zw.AddSlice(i, img)
	}); err != nil {
		log.Fatalf("slice: %v", err)
	}

	if err := zw.Close(); err != nil {
		log.Fatalf("close ZIP: %v", err)
	}
	fmt.Printf("wrote %d layers → %s\n", written, outPath)
}

func writePNG(img image.Image, path string) {
	f, err := os.Create(path)
	if err != nil {
		log.Fatalf("create PNG: %v", err)
	}
	defer f.Close()
	enc := png.Encoder{CompressionLevel: png.BestSpeed}
	if err := enc.Encode(f, img); err != nil {
		log.Fatalf("encode PNG: %v", err)
	}
}
