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


            let experimentId = ((await api.ui.getExperiments()) || []).pop()
            let experiment = experimentId ? await api.ui.getExperiment(experimentId) : undefined

            mainDiv.empty()

            function startDiv(timeUSec) {
                let time = new Date(timeUSec / 1000)
                return DIV("start", [
                    DIV("date").text(time.toLocaleDateString()),
                    DIV("time").text(time.toLocaleTimeString())
                ])
            }

            if (!experiment) {
                mainDiv.append([DIV("nothing").text("No experiment yet.")])
            } else {
                if (experiment.resultBg) {
                    mainDiv.append(
                        DIV("entries", [
                            DIV("kind background").text("Background"),
                            startDiv(experiment.resultBg.startTime),
                            DIV("entry count", [
                                DIV("label").text("Pulse count:"),
                                DIV("value").text(experiment.resultBg.pulseCount?.toFixed(0))
                            ]),
                            DIV("entry duration", [
                                DIV("label").text("Duration:"),
                                DIV("value").text(formatDuration(experiment.resultBg.samplingDuration))
                            ])
                        ])
                    )
                }

                if (experiment.result) {

                    let uncertaintyExponent = experiment.result.neutronYieldUncertainty? Math.floor(Math.log10(experiment.result.neutronYieldUncertainty)): 0
                    let uncertaintyDivider = Math.pow(10, uncertaintyExponent)
                    let neutronYieldUncertaintyStr = (experiment.result.neutronYieldUncertainty / uncertaintyDivider)?.toFixed(1)
                    let neutronYieldStr = (experiment.result.neutronYield / uncertaintyDivider)?.toFixed(1)

                    mainDiv.append(
                        DIV("entries", [
                            startDiv(experiment.result.startTime),
                            DIV("entry count", [
                                DIV("label").text("Pulse count:"),
                                DIV("value").text(experiment.result.pulseCount?.toFixed(0))
                            ]),
                            DIV("entry after", [
                                DIV("label").text("After 1 min.:"),
                                DIV("value").text(experiment.result.pulseCountAfterOneMinute?.toFixed(0))
                            ]),
                            DIV("entry after", [
                                DIV("label").text("Corrected:"),
                                DIV("value").text(experiment.result.pulseCountAfterOneMinuteCorrected?.toFixed(1))
                            ]),
                            DIV("entry saturation", [
                                DIV("label").text("Saturation:"),
                                DIV("value").text(experiment.result.possibleSaturation ? "yes" : "no")
                            ]),
                            DIV("entry calibration", [
                                DIV("label").text("Calibration:"),
                                DIV("value").text({
                                    "valid": "valid",
                                    "invalid": "invalid",
                                    "extrapolation": "extrapol"
                                }[experiment.result.calibration])
                            ]),
                            DIV("entry yield", [
                                DIV("label").html(`Neutron yield (&times10<sup>${uncertaintyExponent}</sup>):`),
                                DIV("value").text(`${neutronYieldStr} ±${neutronYieldUncertaintyStr}`)
                            ]).addClass(`calibration-${experiment.result.calibration}`)
                        ])
                    )
                }
            }

        }

        let page = DIV("page last", [
            DIV("header").text("Last result"),
            DIV("main", d => mainDiv = d)
        ]).onUiEncoderEvent((_, key) => {
            switch (key) {
                case "left":
                    goto("home")
                    break
                case "right":
                    goto("background")
                    break
            }
        })

        asy(updateView)

        return page
    }
}