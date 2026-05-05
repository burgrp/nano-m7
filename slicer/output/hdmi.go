package output

import (
	"image"
	"image/color"
	"runtime"
	"sync"
)

// GrayToHDMI converts a full-resolution monochrome slice image into the
// color-coded HDMI format expected by the BHTM08 driver board.
//
// The FPGA maps HDMI pixels (4440 wide) to display pixels (13320 wide)
// by expanding each RGB color pixel into 3 consecutive mono pixels:
//
//	R channel → pixel x*3+0  (leftmost)
//	G channel → pixel x*3+1  (centre)
//	B channel → pixel x*3+2  (rightmost)
//
// If output looks striped, swap R↔B in the channel assignment below.
// Row conversion is parallelised — the strided 3→4 byte scatter is
// memory-bandwidth bound, so more goroutines help significantly.
func GrayToHDMI(gray *image.Gray) *image.NRGBA {
	srcW := gray.Bounds().Max.X
	h := gray.Bounds().Max.Y
	dstW := srcW / 3
	out := image.NewNRGBA(image.Rect(0, 0, dstW, h))

	workers := runtime.NumCPU()
	var wg sync.WaitGroup
	for w := range workers {
		yStart := w * h / workers
		yEnd := (w + 1) * h / workers
		wg.Add(1)
		go func(y0, y1 int) {
			defer wg.Done()
			for y := y0; y < y1; y++ {
				srcRow := gray.Pix[y*gray.Stride : y*gray.Stride+srcW]
				dstRow := out.Pix[y*out.Stride : y*out.Stride+dstW*4]
				for x := range dstW {
					dstRow[x*4+0] = srcRow[x*3+0] // R ← mono pixel 0
					dstRow[x*4+1] = srcRow[x*3+1] // G ← mono pixel 1
					dstRow[x*4+2] = srcRow[x*3+2] // B ← mono pixel 2
					dstRow[x*4+3] = 255
				}
			}
		}(yStart, yEnd)
	}
	wg.Wait()
	return out
}

// HDMISize returns the HDMI output image dimensions for a given mono resolution.
// widthPx must be divisible by 3.
func HDMISize(widthPx, heightPx int) (w, h int) {
	return widthPx / 3, heightPx
}

// TestPatternHDMI returns a 1-pixel-wide vertical stripe in each channel,
// useful for verifying the R/G/B → mono pixel assignment on the actual display.
//
//	Left third  → pure red   (R=255, G=0,   B=0)
//	Middle third → pure green (R=0,   G=255, B=0)
//	Right third  → pure blue  (R=0,   G=0,   B=255)
//
// On a correct display each third should appear as a uniformly white band.
// If the bands appear in the wrong position the channel order needs swapping.
func TestPatternHDMI(dstW, h int) *image.NRGBA {
	out := image.NewNRGBA(image.Rect(0, 0, dstW, h))
	third := dstW / 3
	for y := range h {
		for x := range dstW {
			var c color.NRGBA
			c.A = 255
			switch {
			case x < third:
				c.R = 255
			case x < 2*third:
				c.G = 255
			default:
				c.B = 255
			}
			out.SetNRGBA(x, y, c)
		}
	}
	return out
}
