import { tags, api, asy, goto } from "webglue";
import {
    checkDisplayWatchdog,
    showError,
    createNavigationHandler
} from "display-utils";

const { DIV, BUTTON } = tags;

export default {
    async render(url, params) {

        this.error = showError
        checkDisplayWatchdog();

        function section(title, entries) {
            return DIV("section", [
                DIV("title").text(title),
                DIV("entries", entries)
            ])
        }

        function entry(title, value, classes = []) {
            return DIV("entry selectable" + (classes.length ? " " + classes.join(" ") : ""), [
                DIV("title").text(title),
                DIV("value").text(value)
            ])
        }

        function genericEditor({ title, description, separator, fields, validator }) {

            return new Promise((resolve, reject) => {

                function close(result) {
                    overlay.remove()
                    resolve(result)
                }

                let fieldDivs = []

                function validate() {
                    if (validator) {
                        let values = fieldDivs.map(d => $(d).text())
                        validator(values)
                        fieldDivs.forEach((d, i) => $(d).text(values[i]))
                    }
                }

                let overlay = DIV("editor modal", [
                    DIV("frame", [
                        DIV("title").text(title),
                        DIV("value", ...fields.map((field, i) => {
                            return [
                                ...separator && i > 0 ? [DIV("fixed").text(separator)] : field.separator ? [DIV("fixed").text(field.separator)] : [],
                                DIV("field selectable" + (i == 0 ? " selected" : ""), d => fieldDivs.push(d))
                                    .text(field.value)
                                    .on("roll", (e, dir) => {
                                        let value = $(e.target).text()
                                        let options = typeof field.options == "function" ? field.options({ values: fieldDivs.map(f => f.text()) }) : field.options
                                        let index = options.indexOf(value) + dir
                                        if (index < 0) {
                                            index = options.length - 1
                                        }
                                        if (index >= options.length) {
                                            index = 0
                                        }
                                        value = options[index]
                                        $(e.target).text(value)
                                        validate()
                                    })
                                    .click(e => {
                                        validate()
                                        $(e.target).toggleClass("rolling")
                                    })
                            ]
                        })),
                        DIV("description").text(description),
                        DIV("buttons", [
                            BUTTON("action selectable").text("OK").click(() => close(fieldDivs.map(d => $(d).text()))),
                            BUTTON("action selectable").text("Cancel").click(() => close(undefined))
                        ])
                    ])
                ])

                page.append(overlay)
            })
        }

        const webUiKeyCharacters = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789" // O and 0 excluded to avoid confusion

        async function webUiKeyEditor({ title, value, description }) {
            let results = await genericEditor({
                title,
                description,
                fields: [...value].map(ch => ({
                    value: ch,
                    options: [...webUiKeyCharacters]
                }))
            })

            return results == undefined ? undefined : results.join("")
        }

        async function ipv4AddressEditor({ title, value, description }) {
            let asNumbers = value.split(".").map(v => parseInt(v) || 0)

            while (asNumbers.length < 4) {
                asNumbers.push(0)
            }
            asNumbers = asNumbers.slice(0, 4)

            let results = await genericEditor({
                title,
                description,
                separator: ".",
                fields: asNumbers.map(v => ({
                    value: v.toString(),
                    options: [...Array(256).keys()].map(v => v.toString())
                }))
            })

            return results == undefined ? undefined : results.join(".")
        }

        async function ipv4MaskEditor({ title, value, description }) {
            let asNumbers = value.split(".").map(v => parseInt(v) || 0)

            while (asNumbers.length < 4) {
                asNumbers.push(0)
            }
            asNumbers = asNumbers.slice(0, 4)

            let results = await genericEditor({
                title,
                description,
                separator: ".",
                fields: [
                    {
                        value: asNumbers.join("."),
                        options: [...Array(16).keys()].map(v => ~((1 << (16 - v)) - 1)).map(v => `${v >>> 24}.${(v >>> 16) & 0xFF}.${(v >>> 8) & 0xFF}.${v & 0xFF}`)
                    }
                ]
            })

            return results == undefined ? undefined : results[0]
        }

        async function hostnameEditor({ title, value, description }) {

            let results = await genericEditor({
                title,
                description,
                fields: [...value.padEnd(12, " ")].map(v => ({
                    value: v,
                    options: [..." abcdefghijklmnopqrstuvwxyz0123456789-"]
                }))
            })

            return results == undefined ? undefined : results.join("").replace(/ /g, "")
        }

        async function simpleEditor({ title, value, description, options }) {

            let results = await genericEditor({
                title,
                description,
                fields: [{
                    value,
                    options
                }]
            })

            return results == undefined ? undefined : results[0]
        }

        async function timezoneEditor({ title, value, description }) {

            value = (value || "").split("/")

            let timezones = Object.entries((await api.ui.getTimezones())
                .map(tz => tz.split("/"))
                .reduce((acc, tz) => ({ ...acc, [tz[0]]: [...acc[tz[0]] || [], tz[1]] }), {})
            )
                .sort(([r1], [r2]) => r1.localeCompare(r2))
                .map(([r, p]) => ({ region: r, places: p.sort() }))

            let results = await genericEditor({
                title,
                description,
                separator: "/",
                validator: values => {
                    let region = timezones.find(tz => tz.region == values[0])
                    if (region) {
                        values[1] = region.places.find(p => p == values[1]) || region.places[0]
                    }
                },
                fields: [{
                    value: value[0],
                    options: timezones.map(tz => tz.region)
                }, {
                    value: value[1],
                    options: ({ values }) => timezones.find(tz => tz.region == values[0]).places
                }]
            })

            return results == undefined ? undefined : results.join("/")
        }

        async function manualTimeEditor({ title, description }) {

            let now = new Date()
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const day = now.getDate();
            const hours = now.getHours();
            const minutes = now.getMinutes();

            function sequence(start, end) {
                return [...Array(end - start + 1).keys()].map(v => (v + start).toString())
            }

            let results = await genericEditor({
                title,
                description,
                fields: [{
                    value: year,
                    options: sequence(2000, 2100),
                }, {
                    separator: "/",
                    value: month,
                    options: sequence(1, 12),
                }, {
                    separator: "/",
                    value: day,
                    options: sequence(1, 31)
                }, {
                    separator: "-",
                    value: hours,
                    options: sequence(0, 23),
                }, {
                    separator: ":",
                    value: minutes,
                    options: sequence(0, 59)
                }
                ]
            })

            if (results == undefined) {
                return undefined
            }

            return new Date(
                parseInt(results[0]),
                parseInt(results[1]) - 1,
                parseInt(results[2]),
                parseInt(results[3]),
                parseInt(results[4])
            ).toLocaleString();
        }

        function editorEntry(title, editorFn, getFn, setFn, description, options, classes) {

            let e = entry(title, getFn(true), classes).click(() => {
                editorFn({ title, value: getFn(false), description, options }).then(result => {
                    if (result != undefined) {
                        e.find(".value").text(result)
                        setFn(result)
                    }
                }).catch(e => {
                    console.error(e)
                })
            })

            return e
        }

        let userSettings = await api.ui.getUserSettings()
        let vendorSettings = await api.ui.getVendorSettings()
        let webUiKeys = await api.ui.getWebUiKeys()
        let triggerSource = (await api.ui.getStatus()).triggerSource
        let manualTime

        function showStaticAddress() {
            $(".static-address").toggleClass("hidden", userSettings.network.dhcp)
        }

        function showManualTime() {
            $(".manual-time").toggleClass("hidden", userSettings.network.ntp)
        }

        function showWebUiKeys() {
            $(".webui-key").toggleClass("hidden", true)
            for (let i = 0; i < webUiKeys.length; i++) {
                $(`.webui-key.${i}`).toggleClass("hidden", false)
            }
        }

        function setWebUiKeys(count) {

            if (webUiKeys.length < count) {
                webUiKeys = [...webUiKeys, ...Array(count - webUiKeys.length).fill(0).map(() => {
                    const chars = webUiKeyCharacters;
                    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                })]
            }
            if (webUiKeys.length > count) {
                webUiKeys = webUiKeys.slice(0, count)
            }
            showWebUiKeys()
        }

        let page = DIV("page settings", [

            DIV("sections", [
                section("Experiment", [
                    editorEntry("Trigger source", simpleEditor,
                        () => triggerSource.charAt(0).toUpperCase() + triggerSource.slice(1),
                        v => { triggerSource = v.toLowerCase() },
                        "The source of the trigger signal.",
                        ["Optic", "Electric", "Detector"]
                    ),
                    editorEntry("Counting time", simpleEditor,
                        () => `${Math.round(userSettings.samplingTimeSec / 60)} min.`,
                        v => { userSettings.samplingTimeSec = parseInt(v.split(" ")[0]) * 60 },
                        "Duration of the experiment",
                        vendorSettings.material.countingTimesMin.map(t => `${t} min.`)
                    ),
                ]),
                section("Network", [
                    editorEntry("Name", hostnameEditor,
                        () => userSettings.network.hostname,
                        v => userSettings.network.hostname = v,
                        "The name of the device on the network. The name must be unique on the network and can contain up to 12 characters.",
                    ),
                    editorEntry("DHCP", simpleEditor,
                        () => userSettings.network.dhcp ? "enabled" : "disabled",
                        v => { userSettings.network.dhcp = v == "enabled"; showStaticAddress() },
                        "DHCP automatically configures the IP address for you. Disable DHCP if you want to configure the IP address manually.",
                        ["enabled", "disabled"]
                    ),
                    DIV("static-address", [
                        editorEntry("Address", ipv4AddressEditor,
                            () => userSettings.network.address,
                            v => userSettings.network.address = v,
                            "The IP address of the device on the network."
                        ),
                        editorEntry("Mask", ipv4MaskEditor,
                            () => userSettings.network.mask,
                            v => userSettings.network.mask = v,
                            "The subnet mask of the device on the network."
                        ),
                        editorEntry("Gateway", ipv4AddressEditor,
                            () => userSettings.network.gateway,
                            v => userSettings.network.gateway = v,
                            "The IP address of the gateway on the network."
                        ),
                        editorEntry("DNS", ipv4AddressEditor,
                            () => userSettings.network.dns,
                            v => userSettings.network.dns = v,
                            "The IP address of the DNS server on the network, use 1.1.1.1 for Cloudflare or 8.8.8.8 for Google."
                        ),
                    ])
                ]),
                section("Time", [
                    editorEntry("Zone", timezoneEditor,
                        () => userSettings.timezone,
                        v => userSettings.timezone = v,
                        "The timezone is used to display the correct time and date.",
                    ),
                    editorEntry("NTP", simpleEditor,
                        () => userSettings.network.ntp ? "enabled" : "disabled",
                        v => { userSettings.network.ntp = v == "enabled"; showManualTime() },
                        "NTP automatically configures the time and date for you. Disable NTP if you want to configure the time and date manually.",
                        ["enabled", "disabled"]
                    ),
                    editorEntry("Set", manualTimeEditor,
                        () => new Date().toLocaleString(),
                        v => manualTime = new Date(v),
                        "Set the time and date manually, if the device is not connected to the internet. Here, the time is formatted as Year/Month/Day-Hour:Minute.",
                        undefined,
                        ["manual-time"]
                    ),
                ]),
                section("Security", [
                    editorEntry("Number of keys", simpleEditor,
                        () => webUiKeys.length,
                        v => setWebUiKeys(parseInt(v)),
                        "There may be up to 10 keys to protect Web UI. Set the number to 0 to disable security.",
                        [...Array(11).fill(0).map((_, i) => (i).toString())]
                    ),
                    ...Array(10).fill(0).map((_, i) =>
                        editorEntry(`Key ${i + 1}`, webUiKeyEditor,
                            menu => menu ? "" : webUiKeys[i],
                            v => {
                                webUiKeys[i] = v
                                $(`.webui-key.${i} .value`).text('')
                            },
                            "The key to protect Web UI.",
                            undefined,
                            [`webui-key`, i]
                        )
                    ),
                ]),
            ]),

            DIV("buttons", [
                BUTTON("action selectable").text("Save").click(() => asy(async () => {
                    await api.ui.applyUserSettings(userSettings)
                    await api.ui.setTriggerSource(triggerSource)
                    await api.ui.setWebUiKeys(webUiKeys)
                    if (manualTime) {
                        await api.ui.setSystemTime(manualTime.getTime() / 1000)
                    }
                    goto("home")
                })),
                BUTTON("action selectable").text("Cancel").click(() => goto("home"))
            ]),

        ])
            .onUiEncoderEvent(createNavigationHandler())
            .onWebglueTick(() => {
                if (!manualTime) {
                    $(".page.settings .entry.manual-time .value").text(new Date().toLocaleString())
                }
            })

        setTimeout(() => {
            $(".selectable").first().addClass("selected")
            showStaticAddress()
            showManualTime()
            showWebUiKeys()
        })

        return page
    }
}