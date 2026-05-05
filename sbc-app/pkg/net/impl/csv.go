package net

import (
	"encoding/csv"
	"strings"
)

type CSV struct {
	stringWriter *strings.Builder
	csvWriter    *csv.Writer
}

func NewCSV() *CSV {
	stringWriter := &strings.Builder{}
	csvWriter := csv.NewWriter(stringWriter)
	csvWriter.Comma = ';'
	return &CSV{
		stringWriter: stringWriter,
		csvWriter:    csvWriter,
	}
}

func (csv *CSV) AddRow(values ...string) *CSV {
	csv.csvWriter.Write(values)
	return csv
}

func (csv *CSV) String() string {
	csv.csvWriter.Flush()
	return csv.stringWriter.String()
}
