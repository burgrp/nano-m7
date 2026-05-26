import { tags, goto, api, asy } from "webglue";

const { DIV, AHREF } = tags;

function decorate(page, url, ...content) {

    var elPrinterName

    var content = [
        DIV("page", [
            DIV("navigation", [
                DIV("printer-name", e => elPrinterName = e),
                AHREF("link home", { href: "home" }, [DIV("fa-solid fa-cube"), DIV("label").text("Models")]),
                AHREF("link resins", { href: "resins" }, [DIV("fa-solid fa-flask"), DIV("label").text("Resins")]),
                AHREF("link service", { href: "service" }, [DIV("fa-solid fa-up-down"), DIV("label").text("Service")]),
                AHREF("link settings", { href: "settings" }, [DIV("fa-solid fa-sliders"), DIV("label").text("Settings")]),
            ]),
            DIV("stage", ...content)
        ])
            .addClass(url)
            .onUiUserSettingsChanged((_, s) => updateStatus(s))
    ]

    $(...content).find(`.navigation .link.${url}`).addClass("active")

    function updateStatus(status) {
        document.title = status.printerName + (page.title? " - " + page.title: "")
        elPrinterName.text(status.printerName)
    }

    asy(async () => {
        updateStatus(await api.ui.getUserSettings())
    })

    return content
}

export {
    decorate
}