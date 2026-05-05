package system

type Config struct {
	UserSettings string `yaml:"userSettings"`
	HttpPort     int    `yaml:"httpPort"`
}
