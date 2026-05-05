import { tags, api, asy, goto } from "webglue";
import { formatDuration } from "utils";
import { checkDisplayWatchdog, showError } from "display-utils";

const { DIV } = tags;

export default {

    async render(url, params) {

        this.error = showError
        checkDisplayWatchdog();

        let mainDiv;

        async function updateView() {

            let userSettings = await api.ui.getUserSettings()

            mainDiv.empty().append(
                DIV("entries", [
                    DIV("entry count", [
                        DIV("label pulses").text("Pulses:"),
                        DIV("value").text(userSettings.backgroundPulses?.toFixed(0))
                    ]),
                    DIV("entry minute", [
                        DIV("label per-minute").text("/min.:"),
                        DIV("value").text(userSettings.backgroundPulsesPerMinute?.toFixed(1))
                    ]),
                    DIV("entry duration", [
                        DIV("label sampling-duration").text("Duration:"),
                        DIV("value").text(formatDuration(userSettings.backgroundSamplingDurationUSec))
                    ])
                ])
            )
        }

        let page = DIV("page background", [
            DIV("header").text("Background"),
            DIV("main", d => mainDiv = d)
        ]).onUiEncoderEvent((_, key) => {
            switch (key) {
                case "left":
                    goto("last")
                    break
                case "right":
                    goto("home")
                    break
                case "push":
                    goto("background-options")
                    break
            }
        })

        asy(updateView)

        return page
    }
}