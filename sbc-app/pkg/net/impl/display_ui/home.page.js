import { tags, api, asy, goto } from "webglue";
import { formatDuration, setText } from "utils";
import { checkDisplayWatchdog, showError } from "display-utils";

const { DIV } = tags;

export default {
    async render(url, params) {

        if (params.token) {
            sessionStorage.setItem("webglue.headers.Authorization", params.token)
        }

        this.error = showError
        checkDisplayWatchdog();

        let rtcDateDiv;
        let rtcTimeDiv;
        let footerBgDiv;
        let counterDiv;
        let hvsVoltsDiv;
        let elapsedTimeDiv;
        let ipAddressDiv;
        let hostnameDiv;
        let triggerSourceDiv;
        let samplingModeDiv;
        let usbDiv

        let timeSkewUs; // clientTime - serverTime
        let startTimeUs; // serverTime when sampling started

        function scheduleTimeUpdates() {
            function updateTimes() {
                let elapsedUs = startTimeUs ? new Date().getTime() * 1000 - timeSkewUs - startTimeUs : 0
                setText(elapsedTimeDiv, formatDuration(elapsedUs))
                let serverTime = new Date(new Date().getTime() - timeSkewUs / 1000)
                setText(rtcDateDiv, serverTime.toLocaleDateString())
                setText(rtcTimeDiv, serverTime.toLocaleTimeString())
            }
            updateTimes();
            for (let i = 1; i < 10; i++) {
                setTimeout(updateTimes, i * 100);
            }
        }

        function updateStatus(status) {
            timeSkewUs = new Date().getTime() * 1000 - status.serverTime
            startTimeUs = status.startTime
            setText(counterDiv, status.counter)
            setText(hvsVoltsDiv, status.hvsVolts)
            setText(hostnameDiv, status.hostname)
            setText(ipAddressDiv, status.ipAddress ? status.ipAddress : "connecting...")
            counterDiv.toggleClass("sampling", status.triggerState == "sampling")
            elapsedTimeDiv.toggleClass("sampling", status.triggerState == "sampling")
            triggerSourceDiv.children().get().forEach(e => $(e).toggleClass("active", $(e).hasClass(status.triggerSource)))
            samplingModeDiv.children().get().forEach(e => $(e).toggleClass("active", $(e).hasClass(status.samplingMode)))
            footerBgDiv.toggleClass("ntp", status.ntp == true)
            usbDiv.toggleClass("mounted", status.usb == "mounted")
            usbDiv.toggleClass("unmounted", status.usb == "unmounted")
        }

        let page = DIV("page home", [
            DIV("header", [
                DIV("hostname", div => hostnameDiv = div),
                DIV("ip-address", div => ipAddressDiv = div)
            ]),
            DIV("main", [
                DIV("counter", div => counterDiv = div),
                DIV("elapsed", div => elapsedTimeDiv = div),
                DIV("hvs with-units volts", div => hvsVoltsDiv = div),
                DIV("flags", [
                    DIV("group trigger-source", [
                        DIV("flag optic").text("opt"),
                        DIV("flag electric").text("el"),
                        DIV("flag detector").text("det"),
                    ], d => triggerSourceDiv = d),
                    DIV("group sampling-mode", [
                        DIV("flag experiment").text("exp"),
                        DIV("flag background").text("bg"),
                    ], d => samplingModeDiv = d)
                ])
            ]),
            DIV("footer", [
                DIV("date", div => rtcDateDiv = div),
                DIV("usb", div => usbDiv = div).text("USB"),
                DIV("time", div => rtcTimeDiv = div)
            ], div => footerBgDiv = div)
        ]).onUiStatusChanged((_, status) => {
            updateStatus(status)
        }).onUiEncoderEvent((_, key) => {
            switch (key) {
                case "left":
                    goto("background")
                    break
                case "right":
                    goto("last")
                    break
                case "push":
                    goto("system")
                    break
            }
        }).onWebglueTick((e) => {
            scheduleTimeUpdates();
        });


        updateStatus(await api.ui.getStatus())
        scheduleTimeUpdates()

        return page
    }

}

