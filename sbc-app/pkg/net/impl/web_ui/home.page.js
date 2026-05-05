import decorate from "decorate";
import { formatDuration, setText } from "utils";
import { tags, api, asy } from "webglue";
import { logicGroup, subGroup, authCheck } from "common";

const { DIV, BUTTON } = tags;

export default {
    title: "SAC",
    check: authCheck,
    async render(url, params) {

        let triggerSources = [
            { value: "optic", label: "Optic" },
            { value: "electric", label: "Electric" },
            { value: "detector", label: "Detector" }
        ];

        let samplingModes = [
            { value: "experiment", label: "Experiment" },
            { value: "background", label: "Background" }
        ]

        let loopButton, readyButton, startButton;
        let sourceButtons = {};
        let hvsVoltsDiv, counterDiv, elapsedTimeDiv, realTimeDiv;
        let modeButtons = {};

        let timeSkewUs; // clientTime - serverTime
        let startTimeUs; // serverTime when sampling started

        function scheduleTimeUpdates() {
            function updateTimes() {
                let elapsedUs = startTimeUs ? new Date().getTime() * 1000 - timeSkewUs - startTimeUs : 0;
                setText(elapsedTimeDiv, formatDuration(elapsedUs));
                setText(realTimeDiv, new Date(new Date().getTime() - timeSkewUs / 1000).toLocaleString());
            }
            updateTimes();
            for (let i = 1; i < 10; i++) {
                setTimeout(updateTimes, i * 100);
            }
        }

        function updateStatus(status) {
            timeSkewUs = new Date().getTime() * 1000 - status.serverTime;
            startTimeUs = status.startTime;
            for (let [source, button] of Object.entries(sourceButtons)) {
                button.toggleClass("selected", source === status.triggerSource);
            }
            loopButton.toggleClass("selected", status.triggerLoop);
            readyButton.toggleClass("selected", status.triggerState == "ready");
            startButton.toggleClass("selected", status.triggerState == "sampling");
            for (let [mode, button] of Object.entries(modeButtons)) {
                button.toggleClass("selected", mode === status.samplingMode);
            }
            hvsVoltsDiv.text(status.hvsVolts);
            counterDiv.text(status.counter);
            counterDiv.toggleClass("sampling", status.triggerState == "sampling");
            elapsedTimeDiv.toggleClass("sampling", status.triggerState == "sampling");
        }

        let page = DIV("home", [
            logicGroup("trigger", "Trigger", [
                subGroup("source", "Source", triggerSources.map(({ value, label }) =>
                    BUTTON("push-button source " + value, b => sourceButtons[value] = b).text(label).click(() => asy(async () => await api.ui.setTriggerSource(value)))
                )),
                BUTTON("push-button big loop", b => loopButton = b).text("Loop").click(() => {
                    asy(async () => await api.ui.toggleTriggerLoop());
                }),
                BUTTON("push-button big action ready", b => readyButton = b).text("Set").click(() => {
                    asy(async () => await api.ui.toggleTriggerReady());
                }),
                BUTTON("push-button big action start", b => startButton = b, [
                    DIV().text("Start"),
                    DIV().text("Stop")
                ]).click(() => {
                    asy(async () => await api.ui.toggleStart());
                }),
            ]),
            logicGroup("detector", "Detector", [
                subGroup("hvs", "GM supply", [
                    DIV("with-units volts", d => hvsVoltsDiv = d).text("-"),
                ]),
                subGroup("counter", "Counter", [
                    DIV(d => counterDiv = d).text("-")
                ]),
                subGroup("mode", "Mode", samplingModes.map(({ value, label }) =>
                    BUTTON("push-button mode " + value, b => modeButtons[value] = b).text(label).click(() => asy(async () => await api.ui.setSamplingMode(value)))
                )),
                subGroup("background", "Background data", [
                    BUTTON("push-button").text("Reset").click(() => asy(async () => await api.ui.resetBackgroundData()))
                ]),
            ]),
            logicGroup("time", "Time", [
                subGroup("elapsed", "Elapsed", [
                    DIV(d => elapsedTimeDiv = d).text("-")
                ]),
                subGroup("real", "Real", [
                    DIV(d => realTimeDiv = d).text("-")
                ])
            ])
        ]).onUiStatusChanged((_, status) => updateStatus(status))
            .onWebglueTick((e) => {
                scheduleTimeUpdates();
            });

        updateStatus(await api.ui.getStatus());
        scheduleTimeUpdates();

        return decorate(this, url, page);
    }
}
