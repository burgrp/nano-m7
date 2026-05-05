import decorate from "decorate";
import { api, asy, tags } from "webglue";
import { authCheck} from "common";

const { DIV, BUTTON, TEXTAREA } = tags;

export default {
    title: "SAC - Settings",
    check: authCheck,
    async render(url, params) {

        let save;

        let page = DIV("setup", [
            TEXTAREA("editor", {
                spellcheck: false
            }, async ta => {
                let data = await api.ui.getUserSettingsYaml();
                ta.val(data);
                save = async () => {
                    data = await api.ui.applyUserSettingsYaml(ta.val());
                    ta.val(data);
                }
            }).keydown(e => {
                if (e.keyCode === 9) {
                    e.preventDefault();
                    let ta = e.target;
                    ta.setRangeText(
                        "  ",
                        ta.selectionStart,
                        ta.selectionStart,
                        'end'
                    );
                }
            }),
            DIV("buttons", [
                BUTTON("push-button save").text("Apply").click(() => asy(save)),
            ])
        ])

        return decorate(this, url, page);
    }
}
