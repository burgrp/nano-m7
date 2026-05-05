import decorate from "decorate";
import { tags, asy, api } from "webglue";
import { logicGroup, showDialog, authCheck } from "common";

const { DIV, BUTTON } = tags;

function getSelectedExperiments() {
    return $(".list .experiment.selected").get().map(el => $(el).text())
}

export default {
    title: "SAC - Experiments",
    check: authCheck,
    async render(url, params) {

        return decorate(this, url, DIV("experiments", [
            logicGroup("all", "All", [

                DIV("list", list => asy(async (div) => {
                    let experiments = (await api.ui.getExperiments()) || []

                    $(".logic-group.detail").toggleClass("hidden", !experiments.length)

                    list.append(experiments.map(exp =>
                        DIV("experiment", { tabIndex: 1 })
                            .text(exp)
                            .click(e => {
                                $(".list .experiment").each((i, el) => {
                                    let thisItem = el === e.target
                                    if (e.ctrlKey) {
                                        if (thisItem) {
                                            $(el).toggleClass("selected")
                                        }
                                    } else if (e.shiftKey) {
                                        let clickedIndex = $(".list .experiment").index(e.target)
                                        let thisIndex = $(".list .experiment").index(el)
                                        let firstSelectedIndex = $(".list .experiment").index($(".list .experiment.selected").first())
                                        let lastSelectedIndex = $(".list .experiment").index($(".list .experiment.selected").last())

                                        $(el).toggleClass("selected", (thisIndex >= firstSelectedIndex && thisIndex <= clickedIndex) || (thisIndex <= lastSelectedIndex && thisIndex >= clickedIndex))

                                    } else {
                                        $(el).toggleClass("selected", thisItem)
                                    }
                                })

                            })
                            .focus(e => asy(async () => {
                                $(".detail .header .label").text(exp)

                                let yaml = await api.ui.getExperimentYaml(exp)
                                $(".detail .content .yaml .text").text(yaml)

                                let data = await api.ui.getExperiment(exp)
                                $(".detail .content .view").toggleClass("experiment", data.result != undefined)
                                $(".detail .content .view").toggleClass("background", data.resultBg != undefined)

                                if (data.resultBg) {
                                    $(".detail .content .background .start .date").text(new Date(data.resultBg.startTime / 1000).toLocaleDateString())
                                    $(".detail .content .background .start .time").text(new Date(data.resultBg.startTime / 1000).toLocaleTimeString())
                                    $(".detail .content .background .entry.count .value").text(data.resultBg.pulseCount)
                                    $(".detail .content .background .entry.duration .value").text(data.resultBg.samplingDuration)
                                }

                                if (data.result) {

                                    let uncertaintyExponent = data.result.neutronYieldUncertainty? Math.floor(Math.log10(data.result.neutronYieldUncertainty)): 0
                                    let uncertaintyDivider = Math.pow(10, uncertaintyExponent)
                                    let neutronYieldUncertaintyStr = (data.result.neutronYieldUncertainty / uncertaintyDivider)?.toFixed(1)
                                    let neutronYieldStr = (data.result.neutronYield / uncertaintyDivider)?.toFixed(1)

                                    $(".detail .content .experiment .start .date").text(new Date(data.result.startTime / 1000).toLocaleDateString())
                                    $(".detail .content .experiment .start .time").text(new Date(data.result.startTime / 1000).toLocaleTimeString())
                                    $(".detail .content .experiment .entry.count .value").text(data.result.pulseCount)
                                    $(".detail .content .experiment .entry.after .value").text(data.result.pulseCountAfterOneMinute)
                                    $(".detail .content .experiment .entry.corrected .value").text(data.result.pulseCountAfterOneMinuteCorrected?.toFixed(1))
                                    $(".detail .content .experiment .entry.saturation .value").text(data.result.possibleSaturation ? "yes" : "no")
                                    $(".detail .content .experiment .entry.calibration .value").text({
                                        "valid": "valid",
                                        "invalid": "invalid",
                                        "extrapolation": "extrapol"
                                    }[data.result.calibration])

                                    $(".detail .content .experiment .entry.yield .label").html(`Neutron yield (&times10<sup>${uncertaintyExponent}</sup>):`),
                                    $(".detail .content .experiment .entry.yield .value").text(`${neutronYieldStr} ±${neutronYieldUncertaintyStr}`)
                                    $(".detail .content .experiment .entry.yield").toggleClass("calibration-invalid", data.result.calibration === "invalid")
                                }

                            }))
                            .keydown(e => {
                                let index = $(".list .experiment").index(e.target)
                                if (e.key === "ArrowDown") {
                                    e.preventDefault()
                                    $(".list .experiment").eq(index + 1).focus()
                                } else if (e.key === "ArrowUp") {
                                    e.preventDefault()
                                    $(".list .experiment").eq(index - 1).focus()
                                } else if (e.key === "Home") {
                                    e.preventDefault()
                                    $(".list .experiment").first().focus()
                                } else if (e.key === "End") {
                                    e.preventDefault()
                                    $(".list .experiment").last().focus()
                                } else if (e.key === " ") {
                                    e.preventDefault()
                                    $(e.target).toggleClass("selected")
                                }
                            })
                    ))

                    setTimeout(() => {
                        $(".list .experiment").last().focus().toggleClass("selected")
                    })

                })),

                DIV("buttons", [
                    BUTTON("push-button action").text("Download").click(() => {
                        let experimentIDs = getSelectedExperiments()
                        if (experimentIDs.length) {
                            window.location = "/download/" + experimentIDs.join(",")
                        }
                    }),
                    BUTTON("push-button action").text("Delete").click(() => asy(async () => {
                        let experimentIDs = getSelectedExperiments()
                        if (experimentIDs.length) {
                            let close
                            close = showDialog([
                                DIV("message").text("Are you sure you want to delete the selected experiments?"),
                                DIV("buttons", [
                                    BUTTON("push-button action").text("Delete").click(() => asy(async () => {
                                        await api.ui.deleteExperiments(experimentIDs)
                                        $(".list .experiment.selected").remove()
                                        close();
                                    })),
                                    BUTTON("push-button").text("Cancel").click(() => {
                                        close();
                                    })
                                ])
                            ])
                        }
                    })),
                    BUTTON("push-button").text("Select All").click(() => {
                        let allChecked = $(".list .experiment").toArray().every(cb => $(cb).hasClass("selected"))
                        $(".list .experiment").toggleClass("selected", !allChecked)
                    })
                ])

            ]),
            logicGroup("detail", "Detail", [
                DIV("view", [
                    DIV("experiment", [
                        DIV("entry start", [
                            DIV("date"),
                            DIV("time")
                        ]),
                        DIV("entry count", [
                            DIV("label").text("Pulse count:"),
                            DIV("value")
                        ]),
                        DIV("entry after", [
                            DIV("label").text("After 1 min.:"),
                            DIV("value")
                        ]),
                        DIV("entry corrected", [
                            DIV("label").text("Corrected:"),
                            DIV("value")
                        ]),
                        DIV("entry saturation", [
                            DIV("label").text("Saturation:"),
                            DIV("value")
                        ]),
                        DIV("entry calibration", [
                            DIV("label").text("Calibration:"),
                            DIV("value")
                        ]),
                        DIV("entry yield", [
                            DIV("label").text("Neutron yield:"),
                            DIV("value")
                        ])
                    ]),
                    DIV("background", [
                        DIV("entry", [DIV("kind").text("Background")]),
                        DIV("entry start", [
                            DIV("date"),
                            DIV("time")
                        ]),
                        DIV("entry count", [
                            DIV("label").text("Pulse count:"),
                            DIV("value")
                        ]),
                        DIV("entry duration", [
                            DIV("label").text("Duration:"),
                            DIV("value")
                        ])
                    ]),
                ]),
                DIV("yaml", [
                    DIV("text")
                ])
            ])
        ]));
    }
}
