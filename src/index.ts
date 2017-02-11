import { Inotify, Event } from 'inotify';
import * as Path from 'path';
import ffmpeg = require('fluent-ffmpeg');
import * as fs from 'fs';

const inotify = new Inotify();
const config: Config = require('../config.json');
prepareConfig(config);

let transcodingQueue: string[] = [];

function main() {
  inotify.addWatch({
    path: config.inputDir,
    watch_for: Inotify.IN_CREATE | Inotify.IN_MOVED_TO,
    callback: fileChange
  })
  console.log("Watching %s...", config.inputDir)
}
main();

function fileChange(event: Event) {
  console.log("Found file %s", event.name);
  let filepath = Path.join(config.inputDir, event.name);
  ffmpeg(filepath).ffprobe((err, data: any) => {
    if (err) {
      console.log("But it doesn't seem to be a video");
      return;
    }
    if (data.streams.some(it => it.codec_type === "subtitle")) {
      console.log("File %s has soft subs! Adding to queue", event.name);
      transcodingQueue.push(event.name);
      workQueue();
    } else {
      console.log("But it has no subtitles!");
    }
  });
}

let working = false;
function workQueue() {
  if (working) {
    return;
  }
  if (transcodingQueue.length === 0) {
    console.log("Queue is empty! Nothing to do...");
    return;
  }

  let filename = transcodingQueue.splice(0, 1)[0];
  let input = Path.join(config.inputDir, filename);
  let outputname = toMp4FileName(filename);
  let output = Path.join(config.outputDir, outputname);

  ffmpeg(input)
    .videoFilter({
      filter: "subtitles",
      options: input
    })
    .on('start', () => {
      console.log("Starting to convert %s to %s", filename, outputname);
    })
    .on('error', (err) => {
      console.log("error while transcoding %s!", filename)
      console.error(err)
      working = false;
      workQueue();
    })
    .on('end', () => {
      console.log("Done converting %s to %s", filename, outputname);
      working = false;
      workQueue();
    })
    .save(output);
}

function toMp4FileName(filename) {
  let parsed = Path.parse(Path.join(config.outputDir, filename));
  let outputfilename = parsed.name + ".mp4";
  if (!fs.existsSync(Path.join(parsed.dir, outputfilename))) {
    return outputfilename;
  }
  let i = 1;
  let name = parsed.name;
  while (true) {
    outputfilename = name + ` (${i}).mp4`;
    if (!fs.existsSync(Path.join(parsed.dir, outputfilename))) {
      return outputfilename;
    }
    i++;
  }
}

function prepareConfig(config: Config) {
  if (!config.outputDir) {
    config.outputDir = config.inputDir;
  }
}