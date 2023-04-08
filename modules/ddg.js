/*
    DuckDuckGo web scraper
*/
import { JSDOM } from 'jsdom'
import * as fs from 'fs'

//slower search but should be fairly stable
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

// faster search + likely better tokenized results
const search_lite = async (q) => {
    const dom = await JSDOM.fromURL(
        "https://lite.duckduckgo.com/lite/?" + new URLSearchParams({
            "q": q
        }),
        {
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36"
        }
    );
    const document = dom.window.document;
    
  

    //document.querySelector("body > form > div > table:nth-child(7) > tbody");
    // the following occurs when "including results for - search only for"
    //document.querySelector("body > form > div > table:nth-child(9) > tbody");
    
    // this shitty xpath evaluator should be more stable -.-
    function getElementByXpath(path) {
        return document.evaluate(path, document, null, dom.window.XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
    const table = getElementByXpath("/html/body/form/div/table[3]/tbody");
    
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
    // [nodeWithContent, nodeWithContent, ...]
    const ts_with_content = [...table.children].filter((node,idx) => ((idx+1) % 4) !== 0);
    // [[nodeWithTitle,nodeWithContent,nodeWithURL],...]
    const tr_groups = [];
    for (let i = 0; i < ts_with_content.length; i += 3) {
        tr_groups.push(ts_with_content.slice(i, i + 3));
    }
    const resultText = tr_groups.slice(0,3).map((array, idx) => {
        const titleNode = array[0];
        const contentNode = array[1];
        const urlNode = array[2];
        // NOTE: scraper isn't including http(s) in the URL so we'll slap https in front (since it's all but standardized on the web now)
        return `${idx+1}. TITLE: [${naiveInnerText(titleNode)}], DESCRIPTION: [${naiveInnerText(contentNode)}], URL: [https://${naiveInnerText(urlNode)}]`
    }).join("\n");
      
    
    return resultText;
}

export { search, search_lite }