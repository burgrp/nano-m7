// Package slice implements CPU-based mesh slicing via triangle-plane intersection + scanline fill.
//
// Pipeline per layer:
//  1. intersectTriangle — find all triangle edges crossing the Z plane → line segments
//  2. buildContours     — chain segments into closed loops (cross-section polygons)
//  3. Rasterize         — parallel Y-band scanline fill with even-odd rule → pixel bitmap
package slice

import (
	"image"
	"math"
	"runtime"
	"sync"

	"github.com/pburgr/nano-m7/slicer/mesh"
)

// Printer describes the physical and pixel dimensions of the build area.
type Printer struct {
	PixelsX, PixelsY  int
	WidthMM, HeightMM float64
}

// Segment is a 2D line segment in the slice plane (mesh coordinates).
type Segment struct{ A, B mesh.Vec2 }

// Contour is a closed loop of 2D points.
type Contour []mesh.Vec2

// SliceAt returns all contours of m at height z (in mesh units).
func SliceAt(m *mesh.Mesh, z float64) []Contour {
	var segs []Segment
	for _, tri := range m.Triangles {
		if s, ok := intersectTriangle(tri, z); ok {
			segs = append(segs, s)
		}
	}
	return buildContours(segs)
}

// Rasterize draws contours onto a Gray image using parallel Y-band scanline fill.
// Mesh XY space is mapped linearly to pixels via the bounding box.
// workers == 0 uses all available CPUs.
func Rasterize(contours []Contour, p Printer, bounds mesh.BoundingBox, workers int) *image.Gray {
	img := image.NewGray(image.Rect(0, 0, p.PixelsX, p.PixelsY))
	if len(contours) == 0 {
		return img
	}

	if workers <= 0 {
		workers = runtime.NumCPU()
	}

	// Scale: physical mm → pixels using the printer's known build area.
	// This preserves true proportions (including non-square pixels on the 14K panel).
	scaleX := float64(p.PixelsX) / p.WidthMM
	scaleY := float64(p.PixelsY) / p.HeightMM

	// Center the model on the build plate.
	modelCX := (bounds.Min.X + bounds.Max.X) / 2
	modelCY := (bounds.Min.Y + bounds.Max.Y) / 2
	plateCX := float64(p.PixelsX) / 2
	plateCY := float64(p.PixelsY) / 2

	pixContours := make([][]image.Point, len(contours))
	for i, c := range contours {
		pts := make([]image.Point, len(c))
		for j, v := range c {
			pts[j] = image.Point{
				X: int(plateCX + (v.X-modelCX)*scaleX),
				Y: int(plateCY + (v.Y-modelCY)*scaleY),
			}
		}
		pixContours[i] = pts
	}

	var wg sync.WaitGroup
	for w := range workers {
		yStart := w * p.PixelsY / workers
		yEnd := (w + 1) * p.PixelsY / workers
		wg.Add(1)
		go func(y0, y1 int) {
			defer wg.Done()
			scanlineFill(img, pixContours, y0, y1)
		}(yStart, yEnd)
	}
	wg.Wait()
	return img
}

// GenerateAll calls onSlice(layerIndex, image) for each layer in bottom-to-top order.
// Only one image exists in memory at a time; onSlice must consume it before returning.
// workers == 0 uses all available CPUs for parallel rasterization within each layer.
func GenerateAll(m *mesh.Mesh, p Printer, layerHeightMM float64, workers int, onSlice func(int, *image.Gray) error) error {
	numLayers := int(math.Ceil(m.Bounds.Size().Z / layerHeightMM))
	for i := range numLayers {
		z := m.Bounds.Min.Z + (float64(i)+0.5)*layerHeightMM
		contours := SliceAt(m, z)
		img := Rasterize(contours, p, m.Bounds, workers)
		if err := onSlice(i, img); err != nil {
			return err
		}
	}
	return nil
}

// intersectTriangle finds the segment where triangle tri crosses the plane at z.
// Uses d[i]*d[j] < 0 to select only edges where vertices are on strictly opposite
// sides — avoids double-counting when a vertex lies exactly on the plane.
func intersectTriangle(tri mesh.Triangle, z float64) (Segment, bool) {
	verts := [3]mesh.Vec3{tri.A, tri.B, tri.C}
	var d [3]float64
	for i, v := range verts {
		d[i] = v.Z - z
	}

	var pts []mesh.Vec2
	for i := range 3 {
		j := (i + 1) % 3
		if d[i]*d[j] < 0 {
			t := d[i] / (d[i] - d[j])
			pts = append(pts, mesh.Vec2{
				X: verts[i].X + t*(verts[j].X-verts[i].X),
				Y: verts[i].Y + t*(verts[j].Y-verts[i].Y),
			})
		}
	}

	if len(pts) != 2 {
		return Segment{}, false
	}
	return Segment{A: pts[0], B: pts[1]}, true
}

// buildContours chains unordered segments into closed contour loops.
//
// For a manifold mesh, each endpoint is shared by exactly two segments, forming
// clean closed loops. Non-manifold input (open chains) is tolerated: any partial
// chain with ≥ 3 points is still returned.
func buildContours(segs []Segment) []Contour {
	if len(segs) == 0 {
		return nil
	}

	// Round endpoints to a 1-nanometre grid to absorb floating-point jitter
	// that would otherwise prevent endpoint matching.
	const grid = 1e-6
	type key struct{ x, y int64 }
	toKey := func(v mesh.Vec2) key {
		return key{
			int64(math.Round(v.X / grid)),
			int64(math.Round(v.Y / grid)),
		}
	}

	// adj maps each endpoint key → indices of segments that touch it.
	adj := make(map[key][]int, len(segs)*2)
	for i, s := range segs {
		ka, kb := toKey(s.A), toKey(s.B)
		adj[ka] = append(adj[ka], i)
		adj[kb] = append(adj[kb], i)
	}

	visited := make([]bool, len(segs))
	var contours []Contour

	for start := range segs {
		if visited[start] {
			continue
		}

		startKey := toKey(segs[start].A)
		contour := []mesh.Vec2{segs[start].A}
		pos := segs[start].A
		idx := start

		for {
			visited[idx] = true
			s := segs[idx]

			// Exit through the end we did NOT enter from.
			var exit mesh.Vec2
			if toKey(pos) == toKey(s.A) {
				exit = s.B
			} else {
				exit = s.A
			}

			if toKey(exit) == startKey {
				break // loop closed
			}

			contour = append(contour, exit)
			pos = exit

			nextIdx := -1
			for _, ni := range adj[toKey(pos)] {
				if !visited[ni] {
					nextIdx = ni
					break
				}
			}
			if nextIdx == -1 {
				break // open chain — non-manifold mesh
			}
			idx = nextIdx
		}

		if len(contour) >= 3 {
			contours = append(contours, Contour(contour))
		}
	}

	return contours
}

// scanlineFill fills rows [yStart, yEnd) of img using even-odd winding rule.
// Each goroutine gets its own xs scratch slice — no shared mutable state.
// Pixel runs are filled via direct Pix slice access so the compiler can emit
// a SIMD memset rather than per-pixel bounds-checked calls.
func scanlineFill(img *image.Gray, contours [][]image.Point, yStart, yEnd int) {
	w := img.Bounds().Max.X
	var xs []int

	for y := yStart; y < yEnd; y++ {
		xs = xs[:0]
		for _, contour := range contours {
			n := len(contour)
			for i := range n {
				a := contour[i]
				b := contour[(i+1)%n]
				// Half-open interval [min,max) avoids double-counting shared vertices.
				if (a.Y <= y && b.Y > y) || (b.Y <= y && a.Y > y) {
					x := a.X + (y-a.Y)*(b.X-a.X)/(b.Y-a.Y)
					xs = append(xs, x)
				}
			}
		}

		insertionSort(xs)

		row := img.Pix[y*img.Stride:]
		for i := 0; i+1 < len(xs); i += 2 {
			x0, x1 := xs[i], xs[i+1]
			if x0 < 0 {
				x0 = 0
			}
			if x1 > w {
				x1 = w
			}
			// fill the run — compiler reduces this to a memset/SIMD store
			for x := x0; x < x1; x++ {
				row[x] = 255
			}
		}
	}
}

func insertionSort(a []int) {
	for i := 1; i < len(a); i++ {
		for j := i; j > 0 && a[j] < a[j-1]; j-- {
			a[j], a[j-1] = a[j-1], a[j]
		}
	}
}
