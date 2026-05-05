import { tags, api } from "webglue";

const { DIV } = tags;

function logicGroup(clazz, label, content) {
    return DIV("common logic-group " + clazz, [
        DIV("header", [
            DIV("label").text(label),
            DIV("chamfer")
        ]),
        DIV("content", content)
    ]);
}

function subGroup(clazz, label, content) {
    return DIV("common sub-group " + clazz, [
        DIV("label").text(label),
        DIV("content", content)
    ]);
}

function showDialog(content, options = {}) {

    function keyHandler(e) {
        if (e.key === "Escape" && !options.noEscape) {
            close();
        }
    }

    function close() {
        $(document).off("keydown", keyHandler);
        $(".overlay").remove();
    }

    (options.parent || $(".page")).append(
        DIV("dialog overlay" + (options.class? " " + options.class: ""), [
            DIV("window", content).click(e => {
                e.stopPropagation();
            })
        ]
        ).click(() => {
            if (!options.noEscape) {
                close();
            }
        })
    );

    $(document).on("keydown", keyHandler);

    return close
}

async function authCheck(url, params) {
    try {
        await api.ui.getStatus()
    } catch (e) {
        if (!url || url == "auth") {
            url = "home"
        } else {
            let ps = Object.entries(params).map(([k, v]) => `${k}=${v}`).join("&")
            if (ps) {
                url = `${url}?${ps}`
            }
        }
        let redirect = `auth?return=${encodeURIComponent(url)}`
        if (e.message != 'unauthorized') {
            redirect = `${redirect}&error=${encodeURIComponent(e.message)}`
        }
        return redirect
    }
}

export { logicGroup, subGroup, showDialog, authCheck };