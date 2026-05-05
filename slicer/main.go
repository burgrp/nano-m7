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
	"strings"

	"github.com/pburgr/nano-m7/slicer/mesh"
	"github.com/pburgr/nano-m7/slicer/output"
	"github.com/pburgr/nano-m7/slicer/slice"
	"github.com/pburgr/nano-m7/slicer/stl"
)

func main() {
	input    := flag.String("input", "", "STL file path (required)")
	out      := flag.String("output", "", "Output path (default: <input>.zip or <input>_<layer>.png with --only)")
	layerUM  := flag.Float64("layer-um", 50, "Layer height in micrometers")
	widthMM  := flag.Float64("width-mm", 218.88, "Build area width in mm")
	heightMM := flag.Float64("height-mm", 122.88, "Build area height in mm")
	pixelsX  := flag.Int("pixels-x", 13320, "Output image width in pixels")
	pixelsY  := flag.Int("pixels-y", 5120, "Output image height in pixels")
	workers  := flag.Int("workers", 0, "Parallel workers per layer (0 = all CPUs)")
	only     := flag.Int("only", -1, "Render only this layer index and save as PNG (for debugging)")
	flag.Parse()

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
	log.Printf("%d layers at %.1f µm → %dx%d px / %.1fx%.1f mm",
		numLayers, *layerUM, p.PixelsX, p.PixelsY, p.WidthMM, p.HeightMM)

	if *only >= 0 {
		renderOne(m, p, layerMM, *workers, *only, numLayers, *input, *out)
	} else {
		renderAll(m, p, layerMM, *workers, numLayers, *input, *out)
	}
}

func renderOne(m *mesh.Mesh, p slice.Printer, layerMM float64, workers, layerIdx, numLayers int, input, outPath string) {
	if layerIdx >= numLayers {
		log.Fatalf("--only=%d out of range (0–%d)", layerIdx, numLayers-1)
	}

	z := m.Bounds.Min.Z + (float64(layerIdx)+0.5)*layerMM
	log.Printf("rendering layer %d / %d  (z=%.4f mm)", layerIdx, numLayers-1, z)

	contours := slice.SliceAt(m, z)
	img := slice.Rasterize(contours, p, m.Bounds, workers)

	if outPath == "" {
		base := strings.TrimSuffix(filepath.Base(input), filepath.Ext(input))
		outPath = fmt.Sprintf("%s_%04d.png", base, layerIdx)
	}
	writePNG(img, outPath)
	fmt.Printf("wrote %s\n", outPath)
}

func renderAll(m *mesh.Mesh, p slice.Printer, layerMM float64, workers, numLayers int, input, outPath string) {
	if outPath == "" {
		base := strings.TrimSuffix(filepath.Base(input), filepath.Ext(input))
		outPath = base + ".zip"
	}

	zw, err := output.OpenZIP(outPath)
	if err != nil {
		log.Fatalf("open output: %v", err)
	}

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

func writePNG(img *image.Gray, path string) {
	f, err := os.Create(path)
	if err != nil {
		log.Fatalf("create PNG: %v", err)
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		log.Fatalf("encode PNG: %v", err)
	}
}
