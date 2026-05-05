package mesh

import "math"

type Vec2 struct{ X, Y float64 }
type Vec3 struct{ X, Y, Z float64 }

type Triangle struct{ A, B, C Vec3 }

type BoundingBox struct {
	Min, Max Vec3
}

func (b BoundingBox) Size() Vec3 {
	return Vec3{b.Max.X - b.Min.X, b.Max.Y - b.Min.Y, b.Max.Z - b.Min.Z}
}

type Mesh struct {
	Triangles []Triangle
	Bounds    BoundingBox
}

func NewMesh(tris []Triangle) *Mesh {
	m := &Mesh{Triangles: tris}
	m.Bounds = computeBounds(tris)
	return m
}

func computeBounds(tris []Triangle) BoundingBox {
	b := BoundingBox{
		Min: Vec3{math.MaxFloat64, math.MaxFloat64, math.MaxFloat64},
		Max: Vec3{-math.MaxFloat64, -math.MaxFloat64, -math.MaxFloat64},
	}
	for _, t := range tris {
		for _, v := range [3]Vec3{t.A, t.B, t.C} {
			if v.X < b.Min.X { b.Min.X = v.X }
			if v.Y < b.Min.Y { b.Min.Y = v.Y }
			if v.Z < b.Min.Z { b.Min.Z = v.Z }
			if v.X > b.Max.X { b.Max.X = v.X }
			if v.Y > b.Max.Y { b.Max.Y = v.Y }
			if v.Z > b.Max.Z { b.Max.Z = v.Z }
		}
	}
	return b
}
