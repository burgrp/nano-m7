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

        let page = DIV("page background-options", [
            DIV("header").text("Background"),
            DIV("main", [
                BUTTON("action selectable").text("Reset counter").click(() => asy(async () => {
                    await api.ui.resetBackgroundData()
                    goto("background")
                })),
                BUTTON("action selectable").text("Start counter").click(() => asy(async () => {
                    await api.ui.startBackgroundCounting()
                    goto("/")
                })),
                BUTTON("action selectable selected").text("Go back").click(e => goto("background")),
            ])
        ]).onUiEncoderEvent(createNavigationHandler())

        return page
    }
}