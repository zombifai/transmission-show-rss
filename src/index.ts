'use strict';

import RssParser from 'rss-parser';
import { Item, Feed } from 'rss-parser';
import * as http from 'request-promise-native';
import * as fs from 'fs';
import * as path from 'path';

// Config options... (just constants for now)
const TRANSMISSION_USER = 'transmission'
const TRANSMISSION_PASS = 'transmission'
const host = 'localhost'
const port = 9091
const AUTO_DOWNLOAD_DIR = '/exports/terra/downloads/auto';

//const stateFile = path.resolve(AUTO_DOWNLOAD_DIR, '.rss-reader.json');
const stateFile = stateFileLocation();
const feed_url = 'http://showrss.info/user/21203.rss?magnets=true&namespaces=true&name=null&quality=null&re=null'

const proto = 'http'
const rpc_path = '/transmission/rpc'
const rpc_url = proto + '://' + host + ':' + port + rpc_path; 

const TRANSMISSION_SESSION_HEADER = 'x-transmission-session-id';

let parser = new RssParser();
var session_id : string|null = null;

function stateFileLocation() {
  let dir = fs.existsSync(AUTO_DOWNLOAD_DIR) ? AUTO_DOWNLOAD_DIR : '/tmp';
  return path.resolve(dir, '.rss-reader.json');
}

async function rpc_call(method: string, args: any) : Promise<any> {

  let headers : any  = {};
  if (session_id) {
    headers[TRANSMISSION_SESSION_HEADER] = session_id;
  }

  let response = await http.post(rpc_url, {
    simple: false,
    resolveWithFullResponse: true,
    headers: headers,
    auth: {
      user: TRANSMISSION_USER,
      pass: TRANSMISSION_PASS
    },
    body: JSON.stringify({
      "method" : method,
      "arguments" : args
    })
  });

  if (response.statusCode==409) {
    session_id = response.headers[TRANSMISSION_SESSION_HEADER];
    console.log("Obtained session id", session_id);
    return await rpc_call(method, args);
  }

  if (response.statusCode >= 300) {
    throw new Error("http error status = "+response.statusCode);
  }

  let result = JSON.parse(response.body);
  return result;
}

async function read_torrents() : Promise<any> {
  return await rpc_call("torrent-get", {
    "fields" : [
      "id", "name", "status"
    ]
  });
}

async function add_torrent(uri : string) : Promise<any> {
  await rpc_call("torrent-add", {
    filename: uri,
    'download-dir': AUTO_DOWNLOAD_DIR
  });
}

async function read_rss() : Promise<Item[]> {

  let feed : Feed = await parser.parseURL(feed_url);
  console.log("Processing feed: ", feed.title);

  return feed.items;
}

interface State {
  [key: string] : ProcessedItem
}

interface ProcessedItem {
  name: string
  date: string
  epoch: number
}

function processedItem(name: string) : ProcessedItem {
  let now = new Date();
  return {
    name: name,
    date: now.toString(),
    epoch: now.getTime()
  };
}

function read_statefile() : Promise<State> {
  return new Promise<State>((resolve, reject) => {
    fs.readFile(stateFile, (err, data) => {
      if (err) {
        console.error("Problem reading statefile", err);
        resolve({});
      } else {
        resolve(JSON.parse(data.toString("utf8")));
      }
    });
  });
}

function write_statefile(state : State) : Promise<undefined> {
  return new Promise((resolve, reject) => {
    fs.writeFile(stateFile, JSON.stringify(state, null, 3), "utf8", (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function main() : Promise<any> {
  try {
    console.log("----------------------------");
    console.log(new Date().toString());
    let rss = await read_rss();
    let processedItems : State = await read_statefile();
    let newItems = 0;
    for (let index = 0; index < rss.length; index++) {
      const item = rss[index];
      if (!processedItems[item.guid]) {
        newItems++;
        console.log("New Item: ", item.title);
        try {
          await add_torrent(item.link);
          console.log("Torrent added!");
          processedItems[item.guid] = processedItem(item.title);
        } catch (e) {
          console.log("Error processing item ", item.title, e);
        }
      }
    }
    await write_statefile(processedItems);
    console.log("Processed ", rss.length, " items ", newItems, " were new.");
  } catch (e) {
    console.error(e);
  }
}

main();
