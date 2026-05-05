import { tags, goto, api } from "webglue";

const { DIV, AHREF } = tags;

let navigation = {
    "home": "Home",
    "experiments": "Experiments",
    "settings": "Settings",
    ...api.virtual ? {
        "virtual": "Virtual"
    } : {}

}

export default (page, url, content) => [
    DIV("page", [
        DIV("navigation", [
            DIV("header", div => {
                function changed(status) {
                    let name = (status.hostname || "sac").toUpperCase();
                    window.document.title = name;
                    div.text(name);
                }
                api.ui.getStatus().then(changed)
                div.onUiStatusChanged((_, status) => changed(status))
            }),
            DIV("menu", () =>
                Object.entries(navigation).map(([key, value]) =>
                    AHREF("item " + key + (url == key ? " selected" : ""), { href: key }).text(value)
                )
            )
        ]),
        DIV("container", [content])
    ])
]

