package system

import (
	"bufio"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

func GetTimezone() (string, error) {

	link, err := os.Readlink("/etc/localtime")
	if err != nil {
		return "", err
	}
	timezone := strings.TrimPrefix(link, "/usr/share/zoneinfo/")
	return timezone, nil
}

func SetTimezone(timezone string) error {

	err := os.Remove("/etc/localtime")
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	err = os.Symlink("/usr/share/zoneinfo/"+timezone, "/etc/localtime")
	if err != nil {
		return err
	}

	return nil
}

func GetTimezones() ([]string, error) {

	file, err := os.Open("/usr/share/zoneinfo/zone1970.tab")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var timezones []string
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "#") {
			fields := strings.Fields(line)
			if len(fields) > 2 {
				timezones = append(timezones, fields[2])
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return timezones, nil
}

func SetSystemTime(unixTimeSec int64) error {

	cmd := exec.Command("date", "-s", "@"+strconv.FormatInt(unixTimeSec, 10))
	err := cmd.Run()
	if err != nil {
		return err
	}

	return nil
}
