import { JSDOM } from 'jsdom'
import * as fs from 'fs'


const search = async (q) => {
    const dom = await JSDOM.fromURL(
        "https://html.duckduckgo.com/html/?" + new URLSearchParams({
            "q": q
        }),
        {
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36"
        }
    );
    const document = dom.window.document;
    
    // JSDOM doesn't support innerText: https://github.com/jsdom/jsdom/issues/1245
    function naiveInnerText(node) {
        const Node = node; // We need Node(DOM's Node) for the constants, but Node doesn't exist in the nodejs global space, and any Node instance references the constants through the prototype chain
        return [...node.childNodes].map(node => {
            switch (node.nodeType) {
                case Node.TEXT_NODE:
                    return node.textContent.trim();
                case Node.ELEMENT_NODE:
                    return naiveInnerText(node);
                default:
                    return "";
            }
        }).filter((element) => element !== "").join(" ");
    }

    // return top 3 results
    return Array.from(document.getElementsByClassName("web-result"))
        .slice(0, 3)
        .map((element, index) => `${index+1}. ${naiveInnerText(element)}`)
        .join("\n");
};  

const search_lite = async (q) => {
    //https://lite.duckduckgo.com/lite/?q=QUERY
    //TODO: scrape this for faster search results
    // easier or harder to format depending on perspective
}

export { search }