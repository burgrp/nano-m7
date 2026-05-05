package output

import (
	"archive/zip"
	"fmt"
	"image"
	"image/png"
	"os"
)

// ZIPWriter streams slice images into a ZIP file one at a time.
// Only one image is held in memory at a time.
type ZIPWriter struct {
	f    *os.File
	zw   *zip.Writer
	enc  png.Encoder
	hdmi bool
}

func (z *ZIPWriter) SetHDMI(hdmi bool) { z.hdmi = hdmi }

func OpenZIP(path string) (*ZIPWriter, error) {
	f, err := os.Create(path)
	if err != nil {
		return nil, err
	}
	return &ZIPWriter{
		f:    f,
		zw:   zip.NewWriter(f),
		enc:  png.Encoder{CompressionLevel: png.BestSpeed},
		hdmi: true,
	}, nil
}

func (z *ZIPWriter) AddSlice(i int, img *image.Gray) error {
	w, err := z.zw.Create(fmt.Sprintf("slices/out%04d.png", i))
	if err != nil {
		return err
	}
	if z.hdmi {
		return z.enc.Encode(w, GrayToHDMI(img))
	}
	return z.enc.Encode(w, img)
}

func (z *ZIPWriter) Close() error {
	if err := z.zw.Close(); err != nil {
		return err
	}
	return z.f.Close()
}
