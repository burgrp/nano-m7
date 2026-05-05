// Package stl parses binary and ASCII STL files.
package stl

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/pburgr/nano-m7/slicer/mesh"
)

func ParseFile(path string) (*mesh.Mesh, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	buf := bufio.NewReader(f)
	header, err := buf.Peek(80)
	if err != nil {
		return nil, err
	}

	if strings.HasPrefix(strings.TrimSpace(string(header)), "solid") {
		return parseASCII(buf)
	}
	return parseBinary(buf)
}

// Binary STL: 80-byte header | uint32 count | count × (12-byte normal + 3×12-byte vertex + 2-byte attr)
func parseBinary(r io.Reader) (*mesh.Mesh, error) {
	var header [80]byte
	if err := binary.Read(r, binary.LittleEndian, &header); err != nil {
		return nil, err
	}

	var count uint32
	if err := binary.Read(r, binary.LittleEndian, &count); err != nil {
		return nil, err
	}

	tris := make([]mesh.Triangle, 0, count)
	for i := uint32(0); i < count; i++ {
		var raw [12]float32 // normal(3) + A(3) + B(3) + C(3)
		if err := binary.Read(r, binary.LittleEndian, &raw); err != nil {
			return nil, fmt.Errorf("triangle %d: %w", i, err)
		}
		var attr uint16
		binary.Read(r, binary.LittleEndian, &attr) //nolint: ignore attr

		tris = append(tris, mesh.Triangle{
			A: mesh.Vec3{X: float64(raw[3]), Y: float64(raw[4]), Z: float64(raw[5])},
			B: mesh.Vec3{X: float64(raw[6]), Y: float64(raw[7]), Z: float64(raw[8])},
			C: mesh.Vec3{X: float64(raw[9]), Y: float64(raw[10]), Z: float64(raw[11])},
		})
	}
	return mesh.NewMesh(tris), nil
}

func parseASCII(r io.Reader) (*mesh.Mesh, error) {
	var tris []mesh.Triangle
	var verts [3]mesh.Vec3
	vi := 0

	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "vertex ") {
			continue
		}
		var x, y, z float64
		if _, err := fmt.Sscanf(line, "vertex %f %f %f", &x, &y, &z); err != nil {
			return nil, fmt.Errorf("malformed vertex line %q: %w", line, err)
		}
		verts[vi] = mesh.Vec3{X: x, Y: y, Z: z}
		vi++
		if vi == 3 {
			tris = append(tris, mesh.Triangle{A: verts[0], B: verts[1], C: verts[2]})
			vi = 0
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return mesh.NewMesh(tris), nil
}
