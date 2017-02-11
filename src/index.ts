import { Inotify, Event } from 'inotify';
import * as Path from 'path';
import ffmpeg = require('fluent-ffmpeg');
import * as fs from 'fs';
import * as express from 'express';
import * as nunjucks from 'nunjucks';
import * as uuid from 'node-uuid';

const inotify = new Inotify();
const config: Config = require('../config.json');
const exp = express();
prepareConfig(config);

nunjucks.configure(Path.resolve(__dirname, "..", "server"), {
  express: exp,
  noCache: true
})

exp.use('/', express.static(Path.resolve(__dirname, "..", "server")))
exp.get('/status', (req, res) => {
  res.send(transcodingStatus);
})
exp.get('/delete/:id', (req, res) => {
  try {
    deleteFromQueue(req.params.id);
    res.send({ message: "ok" , queue: transcodingStatus.queue})
  } catch (message) {
    res.send({ message });
  }
})
exp.get('kill', (req, res) => {
  kill();
  res.send({message: "ok"});
})

function main() {
  let port = config.httpPort || 8080;
  exp.listen(port)
  console.log("Listening on %d...", port);
  inotify.addWatch({
    path: config.inputDir,
    watch_for: Inotify.IN_CREATE | Inotify.IN_MOVED_TO,
    callback: fileChange
  })
  console.log("Watching %s...", config.inputDir)
  initialAdd();
}

async function initialAdd() {
  console.log("adding all files from %s", config.inputDir)
  let files = fs.readdirSync(config.inputDir);
  files = files.filter(it => fs.statSync(Path.join(config.inputDir, it)).isFile())
  files = await asyncFilter(files, isTranscodable);
  files.forEach(addFile);
  workQueue();
}

async function fileChange(event: Event) {
  console.log("Found file %s", event.name);
  if (await isTranscodable(event.name)) {
    console.log("File %s has soft subs! Adding to queue", event.name);
    addFile(event.name);
    workQueue();
  } else {
    console.log("But it's not transcodable");
  }
}


let transcodingStatus: Status = {
  working: false,
  currentFile: "",
  currentProgress: 0,
  queue: []
}

let currentCommand;

function workQueue() {
  if (transcodingStatus.working) {
    return;
  }
  if (transcodingStatus.queue.length === 0) {
    console.log("Queue is empty! Nothing to do...");
    return;
  }

  let anime = transcodingStatus.queue.splice(0, 1)[0];
  let input = Path.join(config.inputDir, anime.filename);
  let outputname = Path.parse(anime.filename).name + ".mp4";
  let output = Path.join(config.outputDir, outputname);

  if (fs.existsSync(output)) {
    console.log("Ignoring file %s -> %s as it already exists!", anime.filename, outputname);
    workQueue();
    return;
  }
  currentCommand = ffmpeg(input)
    .videoFilter({
      filter: "subtitles",
      options: ffescape(input)
    })
    .on('start', () => {
      transcodingStatus.working = true;
      transcodingStatus.currentFile = outputname;
      console.log("Starting to convert %s to %s", anime.filename, outputname);
    })
    .on('progress', (progress) => {
      transcodingStatus.currentProgress = progress.percent;
    })
    .on('error', (err) => {
      console.log("error while transcoding %s!", anime.filename)
      console.error(err)
      resetCurrent()
      workQueue();
    })
    .on('end', () => {
      console.log("Done converting %s to %s", anime.filename, outputname);
      resetCurrent()
      workQueue();
    })
    .save(output);
}

function resetCurrent() {
  transcodingStatus.working = false;
  transcodingStatus.currentFile = "";
  transcodingStatus.currentProgress = 0;
  currentCommand = undefined;
}

function prepareConfig(config: Config) {
  if (!config.outputDir) {
    config.outputDir = config.inputDir;
  }
}

function addFile(filename: string) {
  transcodingStatus.queue.push({
    filename,
    id: uuid.v4()
  })
}

function ffescape(filename: string) {
  return "'" + filename.replace(/'/g, "'\\''") + "'";
}

function isTranscodable(filename: string): Promise<boolean> {
  let filepath = Path.join(config.inputDir, filename);
  return new Promise((res, rej) => {
    ffmpeg(filepath).ffprobe((err, data: any) => {
      if (err) {
        return res(false);
      }
      if (data.streams.some(it => it.codec_type === "subtitle")) {
        return res(true);
      } else {
        return res(false);
      }
    });
  });
}

function asyncFilter<T>(array: T[], predicate: (T) => Promise<boolean>): Promise<T[]> {
  let promises = [];
  array.forEach(val => {
    promises.push(predicate(val));
  })
  return Promise.all(promises).then(results => array.filter((val, i) => results[i]))
}

function deleteFromQueue(id: string) {
  let index = transcodingStatus.queue.findIndex(it => it.id === id);
  if (index >= 0) {
    throw "Item not found";
  } else {
    transcodingStatus.queue.splice(index, 1);
  }
}

function kill() {
  if (currentCommand) {
    currentCommand.kill();
  }
}

main();