import { decorate } from "common"
import { tags, api, asy } from "webglue"

const { DIV, BUTTON } = tags

export default {
    title: "Models",
    async render(url, params) {

        let page = DIV("home", [
        ]).text("NAZDAR M7")

        return decorate(this, url, [page]);
    }
}
