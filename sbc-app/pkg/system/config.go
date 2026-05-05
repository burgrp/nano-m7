package system

type HttpServerConfig struct {
	WebPort     int    `yaml:"webPort"`
	DisplayPort int    `yaml:"displayPort"`
	DisplayFifo string `yaml:"displayFifo"` // used to be a path, now it's just a flag to start the display service
}

type VirtualHardwareConfig struct {
	Display struct {
		Width  int `yaml:"width"`
		Height int `yaml:"height"`
	} `yaml:"display"`
	Usb string `yaml:"usb"`
}

type LinuxHardwareConfig struct {
	Encoder string `yaml:"encoder"`
	Keys    string `yaml:"keys"`
	HvsAdc  string `yaml:"hvsAdc"`
	GPIO    struct {
		Chip string `yaml:"chip"`
		Pins struct {
			TriggerOptic    int `yaml:"triggerOptic"`
			TriggerElectric int `yaml:"triggerElectric"`
			DetectorInput   int `yaml:"detectorInput"`
			HvsSwitch       int `yaml:"hvsSwitch"`
			LedLoop         int `yaml:"ledLoop"`
			LedSet          int `yaml:"ledSet"`
			LedStart        int `yaml:"ledStart"`
		} `yaml:"pins"`
	} `yaml:"gpio"`
}

type Config struct {
	Http           HttpServerConfig `yaml:"http"`
	UserSettings   string           `yaml:"userSettings"`
	VendorSettings string           `yaml:"vendorSettings"`
	ExperimentData string           `yaml:"experimentData"`
	WebUiKeys      string           `yaml:"webUiKeys"`
	Hal            struct {
		Virtual *VirtualHardwareConfig `yaml:"virtual"`
		Linux   *LinuxHardwareConfig   `yaml:"linux"`
	}
}
