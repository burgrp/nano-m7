import decorate from "decorate";
import { api, asy, tags } from "webglue";
import { logicGroup, subGroup, authCheck} from "common";

const { DIV, BUTTON, ICON, FIELDSET, INPUT, NUMBER, IFRAME } = tags;

export default {
    title: "SAC - Virtual hardware",
    check: authCheck,
    async render(url, params) {

        window.api = api

        let ledDivs = {};

        let page = DIV("virtual", [
            logicGroup("panel", "Panel", [
                BUTTON("push-button big loop", b => ledDivs.loop = b, b => b.text("Loop").click(() => asy(async () => await api.virtual.userInputEvent("loopDown")))),
                BUTTON("push-button big action ready", b => ledDivs.ready = b, b => b.text("Set").click(() => asy(async () => await api.virtual.userInputEvent("readyDown")))),
                BUTTON("push-button big action start", b => ledDivs.start = b, [
                    DIV().text("Start"),
                    DIV().text("Stop")
                ], b => b.click(() => asy(async () => await api.virtual.userInputEvent("startDown")))),
                subGroup("encoder", "Encoder", [
                    BUTTON("tool-button", [ICON("fa-solid fa-rotate-left")]).click(() => asy(async () => await api.virtual.userInputEvent("encLeft"))),
                    BUTTON("tool-button", [ICON("fa-solid fa-circle-dot")]).click(() => asy(async () => await api.virtual.userInputEvent("encPush"))),
                    BUTTON("tool-button", [ICON("fa-solid fa-rotate-right")]).click(() => asy(async () => await api.virtual.userInputEvent("encRight"))),
                ]),
                DIV("display", async (div) => {
                    let params = await api.virtual.getDisplayParams();
                    let token = await api.ui.getDisplayToken();
                    div.append(IFRAME().attr({
                        src: window.location.protocol + "//" + window.location.hostname + ":" + params.port + "?token=" + encodeURIComponent(token),
                        width: params.width,
                        height: params.height,
                    }));
                }),
                subGroup("inputs", "Inputs", [
                    BUTTON("push-button big action optic", b => b.text("Opt").click(() => asy(async () => await api.virtual.simulateTriggerOptic()))),
                    BUTTON("push-button big action electric", b => b.text("El").click(() => asy(async () => await api.virtual.simulateTriggerElectric()))),
                    BUTTON("push-button big action det", b => b.text("Det").click(() => asy(async () => await api.virtual.simulateDetectorPulse()))),
                ]),
                subGroup("usb", "USB", [
                    DIV("hole", [
                        DIV("frame", [
                            DIV("plastic"),
                            DIV("pins", [
                                DIV("pin"),
                                DIV("pin"),
                                DIV("pin"),
                                DIV("pin")
                            ])
                        ]).click(() => asy(async () => {
                            $(".usb .disk").toggleClass("inserted", true);
                            await api.virtual.usbInserted()
                        })),
                        DIV("disk").click(() => asy(async () => {
                            await api.virtual.usbRemoved()
                            $(".usb .disk").toggleClass("inserted", false);
                        })),
                    ])
                ]),
            ]),
            logicGroup("experiment", "Experiment", [
                subGroup("background-pulses", "Background pulses", [
                    DIV([
                        NUMBER().attr({
                            min: 0,
                            step: 1
                        }).val(60),
                        DIV("suffix").text("/min"),
                    ]),
                    BUTTON("push-button big").text("Apply").click(() => asy(async () => await api.virtual.setBackgroundPulses(parseFloat($(".background-pulses input").val())))),
                ]),
                subGroup("materials", "Materials", [
                    FIELDSET(async fs => {
                        fs.append(
                            (await api.virtual.getMaterials()).map((material) =>
                                DIV("material", [
                                    INPUT().prop({ name: "material", type: "radio", checked: material.symbol == "Ag", symbol: material.symbol }),
                                    DIV("texts", [
                                        DIV("name").text(material.name),
                                        DIV("isotopes", material.isotopes.map(isotope =>
                                            DIV("isotope", [
                                                DIV("number").text(material.symbol + "-" + isotope.number),
                                                DIV("half-life").html(`(T<sub>1/2</sub> = ${isotope.halfLifeSec} s)`),
                                            ])
                                        ))
                                    ])
                                ])
                            )
                        )
                    })
                ]),
                DIV("start-group", [
                    subGroup("active-nuclides", "Active nuclides", [
                        NUMBER().attr({
                            min: 0,
                            step: 1
                        }).val(1000)
                    ]),
                    BUTTON("push-button big action start").text("Shot").click(() => asy(async () => await api.virtual.startExperiment(
                        $("fieldset .material>input:checked").prop("symbol"),
                        parseInt($(".active-nuclides input").val())
                    ))),
                ])
            ]),
        ]);

        function updateLeds(leds) {
            for (let key in leds) {
                let color = leds[key];
                if (!color) {
                    color = 0x808080;
                }
                color = "#" + color.toString(16).toUpperCase().padStart(6, "0")
                ledDivs[key].css({
                    "background-color": color
                });
            }
        }

        page.onVirtualLedsUpdated((_, leds) => updateLeds(leds));

        api.virtual.getLeds().then(leds => updateLeds(leds));

        return decorate(this, url, page);
    }
}
