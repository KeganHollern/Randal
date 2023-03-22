import {google} from 'googleapis'
const kgsearch = google.kgsearch({
    version: "v1",
    auth: process.env.GOOGLE_API_KEY
});

let query = async  (q) => {
    const res = await kgsearch.entities.search({
             // The list of language codes (defined in ISO 693) to run the query with, e.g. 'en'.
             languages: 'en',
             // Limits the number of entities to be returned.
             limit: '3',
             // The literal query string for search.
             query: q,
           });
    if(res.data.itemListElement.length == 0) {
        return ""
    }
    let content = "";
    res.data.itemListElement.forEach((element, index) => {
        const result = element.result;
        content += `${index+1}. ${result.name}`
        if(result.description !== undefined) {
            content += `: ${result.description}\n`
        }
        if(result.detailedDescription?.articleBody !== undefined) {
            content += `\t${result.detailedDescription.articleBody}\n`
        }
    }); 

    return content
}

export { query }