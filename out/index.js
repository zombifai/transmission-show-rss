'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
}
Object.defineProperty(exports, "__esModule", { value: true });
const rss_parser_1 = __importDefault(require("rss-parser"));
const http = __importStar(require("request-promise-native"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Config options... (just constants for now)
const TRANSMISSION_USER = 'transmission';
const TRANSMISSION_PASS = 'transmission';
const host = 'droid';
const port = 9091;
const AUTO_DOWNLOAD_DIR = '/exports/terra/downloads/auto';
const stateFile = stateFileLocation();
const feed_url = 'http://showrss.info/user/21203.rss?magnets=true&namespaces=true&name=null&quality=null&re=null';
const proto = 'http';
const rpc_path = '/transmission/rpc';
const rpc_url = proto + '://' + host + ':' + port + rpc_path;
const TRANSMISSION_SESSION_HEADER = 'x-transmission-session-id';
let parser = new rss_parser_1.default();
var session_id = null;
function stateFileLocation() {
    let dir = fs.existsSync(AUTO_DOWNLOAD_DIR) ? AUTO_DOWNLOAD_DIR : '/tmp';
    return path.resolve(dir, '.rss-reader.json');
}
function rpc_call(method, args) {
    return __awaiter(this, void 0, void 0, function* () {
        let headers = {};
        if (session_id) {
            headers[TRANSMISSION_SESSION_HEADER] = session_id;
        }
        let response = yield http.post(rpc_url, {
            simple: false,
            resolveWithFullResponse: true,
            headers: headers,
            auth: {
                user: TRANSMISSION_USER,
                pass: TRANSMISSION_PASS
            },
            body: JSON.stringify({
                "method": method,
                "arguments": args
            })
        });
        if (response.statusCode == 409) {
            session_id = response.headers[TRANSMISSION_SESSION_HEADER];
            console.log("Obtained session id", session_id);
            return yield rpc_call(method, args);
        }
        if (response.statusCode >= 300) {
            throw new Error("http error status = " + response.statusCode);
        }
        let result = JSON.parse(response.body);
        return result;
    });
}
function read_torrents() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield rpc_call("torrent-get", {
            "fields": [
                "id", "name", "status"
            ]
        });
    });
}
function add_torrent(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        yield rpc_call("torrent-add", {
            filename: uri,
            'download-dir': AUTO_DOWNLOAD_DIR
        });
    });
}
function read_rss() {
    return __awaiter(this, void 0, void 0, function* () {
        let feed = yield parser.parseURL(feed_url);
        console.log("Processing feed: ", feed.title);
        return feed.items;
    });
}
function processedItem(name) {
    let now = new Date();
    return {
        name: name,
        date: now.toDateString(),
        epoch: now.getTime()
    };
}
function read_statefile() {
    return new Promise((resolve, reject) => {
        fs.readFile(stateFile, (err, data) => {
            if (err) {
                console.error("Problem reading statefile", err);
                resolve({});
            }
            else {
                resolve(JSON.parse(data.toString("utf8")));
            }
        });
    });
}
function write_statefile(state) {
    return new Promise((resolve, reject) => {
        fs.writeFile(stateFile, JSON.stringify(state, null, 3), "utf8", (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("----------------------------");
            console.log(new Date().toDateString());
            let rss = yield read_rss();
            let processedItems = yield read_statefile();
            let newItems = 0;
            for (let index = 0; index < rss.length; index++) {
                const item = rss[index];
                if (!processedItems[item.guid]) {
                    newItems++;
                    console.log("New Item: ", item.title);
                    try {
                        yield add_torrent(item.link);
                        console.log("Torrent added!");
                        processedItems[item.guid] = processedItem(item.title);
                    }
                    catch (e) {
                        console.log("Error processing item ", item.title, e);
                    }
                }
            }
            yield write_statefile(processedItems);
            console.log("Processed ", rss.length, " items ", newItems, " were new.");
        }
        catch (e) {
            console.error(e);
        }
    });
}
main();
//# sourceMappingURL=index.js.map