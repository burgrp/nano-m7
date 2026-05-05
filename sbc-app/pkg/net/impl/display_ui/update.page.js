import { tags, api, asy, goto } from "webglue"
import {
    checkDisplayWatchdog,
    showError,
    createNavigationHandler
} from "display-utils"

const { DIV, BUTTON } = tags

export default {

    async render(url, params) {

        this.error = showError
        checkDisplayWatchdog()

        let titleEl, statusEl, availableVersionEl, installedVersionEl, streamEl

        let page = DIV("page update", [
            DIV("header", el => titleEl = el).text("Checking for Updates..."),
            DIV("status working", [
                DIV("animation"),
                DIV("ui", [
                    DIV("entries", [
                        DIV("entry installed", [
                            DIV("label").text("Installed:"),
                            DIV("value", el => installedVersionEl = el),
                        ]),
                        DIV("entry available", [
                            DIV("label").text("Available:"),
                            DIV("value", el => availableVersionEl = el),
                        ]),
                        DIV("entry stream", [
                            DIV("label").text("Stream:"),
                            DIV("value", el => streamEl = el),
                        ])
                    ]),
                    DIV("uptodate").text("System is up to date."),
                    DIV("buttons", [
                        BUTTON("action selectable update").text("Update").click(() => {
                            statusEl.toggleClass("working", true)
                            titleEl.text("Updating...")
                            asy(async () => {
                                await api.ui.updateSystem(availableVersionEl.text())
                            })
                        }),
                        BUTTON("action selectable selected").text("Go back").click(e => goto("home")),
                    ]),
                ])
            ], el => statusEl = el),
        ])
            .onUiEncoderEvent(createNavigationHandler())
            .onUiSystemUpdateInfo((e, info) => {
                statusEl.toggleClass("uptodate", info.installedVersion == info.availableVersion)
                titleEl.text("System")
                installedVersionEl.text(info.installedVersion)
                availableVersionEl.text(info.availableVersion)
                streamEl.text(info.stream)
                statusEl.toggleClass("working", false)
                if (info.error) {
                    showError(info.error)
                }
            })

        asy(api.ui.getSystemUpdateInfo)

        return page
    }
}
