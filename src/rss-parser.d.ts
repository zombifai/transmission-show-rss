declare module 'rss-parser' {
    export default Parser;

    export interface Feed {
        title: string;
        items: Item[];
    }

    export interface Item {
        title: string;
        guid: string;
        link: string;        
    }
    
    class Parser {
        constructor();
        parseURL(url : string) : Promise<Feed> 
    }
}

