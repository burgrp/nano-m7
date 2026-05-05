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

        let page = DIV("page system", [
            DIV("header").text("System"),
            DIV("main", [
                BUTTON("action selectable selected").text("Settings").click(() => goto("settings")),
                BUTTON("action selectable").text("Update").click(() => goto("update")),
                BUTTON("action selectable").text("Go back").click(e => goto("home")),
            ])
        ]).onUiEncoderEvent(createNavigationHandler())

        return page
    }
}