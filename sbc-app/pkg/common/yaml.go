package common

import (
	"os"

	"gopkg.in/yaml.v2"
)

func LoadYaml(fileName string, data any) error {
	raw, err := os.ReadFile(fileName)
	if err != nil {
		return err
	}
	return yaml.Unmarshal(raw, data)
}

func SaveYaml(fileName string, data any) error {
	raw, err := yaml.Marshal(data)
	if err != nil {
		return err
	}
	return os.WriteFile(fileName, raw, 0644)
}
