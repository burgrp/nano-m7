import { tags, goto, api } from "webglue";

const { DIV, AHREF } = tags;

function decorate(page, url, content) {
    return [
        DIV("page", [
            DIV("navigation", []),
            DIV("container", [content])
        ])
    ]
}

export {
    decorate
}