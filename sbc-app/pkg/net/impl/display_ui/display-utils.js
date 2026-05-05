import { api, asy, tags } from "webglue";

const { DIV } = tags;

function checkDisplayWatchdog() {
    if (!window.watchdogStarted) {
        asy(async () => {
            window.watchdogStarted = true;
            while (true) {
                await (() => new Promise(resolve => setTimeout(resolve, 1000)))();
                try {
                    await api.ui.displayAlive()
                } catch (e) {
                    console.error("Display watchdog failed", e)
                }
            }
        })
    }
}

function showError(error) {
    $(".page").append(DIV("error", d => setTimeout(() => d.fadeOut(5000, () => d.remove()))).text(error.message? error.message: error));
}

function createNavigationHandler() {

    function selectNext(dir) {
        let rolling = $(".rolling")
        if (rolling.get().length > 0) {

            rolling.trigger("roll", dir)

        } else {

            let modalFilter = $(".modal").get().length > 0 ? ".modal " : ""
            let selectable = $(modalFilter + ".selectable:not(.hidden .selectable, .hidden.selectable)").get()
            let index = selectable.findIndex(e => e.classList.contains("selected"))
            index += dir
            if (index < 0) {
                index = selectable.length - 1
            }
            if (index >= selectable.length) {
                index = 0
            }
            selectable.forEach((e, i) => {
                let selected = i == index
                $(e).toggleClass("selected", selected)
                if (selected) {
                    e.scrollIntoView({ behavior: "smooth", block: "nearest" })
                }
            })

        }
    }

    return function (_, key) {
         switch (key) {
            case "left":
                selectNext(-1)
                break
            case "right":
                selectNext(1)
                break
            case "push":
                let modalFilter = $(".modal").get().length > 0 ? ".modal " : ""
                let selected = $(modalFilter + ".selectable.selected:not(.hidden .selectable, .hidden.selectable)")
                selected.click()
                break
        }

    }
}

export { checkDisplayWatchdog, showError, createNavigationHandler };