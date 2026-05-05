import { tags, api, asy, goto } from "webglue";
import { showDialog } from "common";

const { DIV, BUTTON, INPUT } = tags;

export default {
    title: "SAC",
    async render(url, params) {

        let divError

        let pageDiv = DIV("page auth")

        let close = showDialog([
            DIV("message").text("Please provide your access key to proceed."),
            DIV("entry",
                [
                    INPUT({
                        "maxLength": 6,
                        "type": "password"
                    },
                        el => setTimeout(() => el.focus(), 0)
                    ).keyup(e => {
                        let input = e.target
                        let key = input.value.toUpperCase()
                        if (key.length == 6) {
                            asy(async () => {
                                try {
                                    let token = await api.ui.authenticate(key)
                                    localStorage.setItem("webglue.headers.Authorization", token)
                                    close()
                                    goto(params.return || "home")
                                } catch (e) {
                                    divError.text(e.message)
                                }
                            })

                        }
                        divError.text("")
                    }),
                    BUTTON("fa-solid fa-eye").click(() => {
                        let input = document.querySelector(".dialog input")
                        if (input.type == "password") {
                            input.type = "text"
                        } else {
                            input.type = "password"
                        }
                        let button = document.querySelector(".dialog button")
                        button.classList.toggle("fa-eye")
                        button.classList.toggle("fa-eye-slash")
                        input.focus()
                    })
                ]),
            DIV("error", el => divError = el)
        ], {
            noEscape: true,
            class: "auth",
            parent: pageDiv
        });

        if (params.error) {
            divError.text(params.error)
        }

        return pageDiv

    }
}

