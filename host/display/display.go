package display

import (
	"fmt"

	"github.com/veandco/go-sdl2/img"
	"github.com/veandco/go-sdl2/sdl"
)

type Display struct {
	window   *sdl.Window
	renderer *sdl.Renderer
	fullscreen bool
}

// New creates a display window. If fullscreen is true, takes over the entire screen.
// width/height are used only in windowed mode.
func New(fullscreen bool, width, height int32) (*Display, error) {
	if err := sdl.Init(sdl.INIT_VIDEO); err != nil {
		return nil, fmt.Errorf("sdl init: %w", err)
	}

	flags := uint32(sdl.WINDOW_SHOWN)
	if fullscreen {
		flags |= sdl.WINDOW_FULLSCREEN_DESKTOP
	}

	window, err := sdl.CreateWindow(
		"NanoM7",
		sdl.WINDOWPOS_UNDEFINED, sdl.WINDOWPOS_UNDEFINED,
		width, height,
		flags,
	)
	if err != nil {
		sdl.Quit()
		return nil, fmt.Errorf("sdl window: %w", err)
	}

	renderer, err := sdl.CreateRenderer(window, -1, sdl.RENDERER_ACCELERATED)
	if err != nil {
		window.Destroy()
		sdl.Quit()
		return nil, fmt.Errorf("sdl renderer: %w", err)
	}

	sdl.ShowCursor(sdl.DISABLE)

	d := &Display{window: window, renderer: renderer, fullscreen: fullscreen}
	d.Blank()
	return d, nil
}

// Blank clears the display to black.
func (d *Display) Blank() {
	d.renderer.SetDrawColor(0, 0, 0, 255)
	d.renderer.Clear()
	d.renderer.Present()
}

// Show displays a PNG file centered (and scaled to fit) on the display.
func (d *Display) Show(pngPath string) error {
	surface, err := img.Load(pngPath)
	if err != nil {
		return fmt.Errorf("load image %s: %w", pngPath, err)
	}
	defer surface.Free()

	texture, err := d.renderer.CreateTextureFromSurface(surface)
	if err != nil {
		return fmt.Errorf("create texture: %w", err)
	}
	defer texture.Destroy()

	winW, winH := d.window.GetSize()
	imgW, imgH := surface.W, surface.H

	// scale to fit, preserve aspect ratio
	scaleX := float32(winW) / float32(imgW)
	scaleY := float32(winH) / float32(imgH)
	scale := scaleX
	if scaleY < scale {
		scale = scaleY
	}
	dstW := int32(float32(imgW) * scale)
	dstH := int32(float32(imgH) * scale)
	dstX := (winW - dstW) / 2
	dstY := (winH - dstH) / 2

	dst := &sdl.Rect{X: dstX, Y: dstY, W: dstW, H: dstH}
	d.renderer.SetDrawColor(0, 0, 0, 255)
	d.renderer.Clear()
	d.renderer.Copy(texture, nil, dst)
	d.renderer.Present()

	// drain SDL events to keep window responsive
	for {
		e := sdl.PollEvent()
		if e == nil {
			break
		}
		_ = e
	}

	return nil
}

func (d *Display) Close() {
	d.renderer.Destroy()
	d.window.Destroy()
	sdl.Quit()
}
