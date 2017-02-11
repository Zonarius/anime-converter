"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const inotify_1 = require("inotify");
const Path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const express = require("express");
const nunjucks = require("nunjucks");
const uuid = require("node-uuid");
const inotify = new inotify_1.Inotify();
const config = require('../config.json');
const exp = express();
prepareConfig(config);
nunjucks.configure(Path.resolve(__dirname, "..", "server"), {
    express: exp,
    noCache: true
});
exp.use('/', express.static(Path.resolve(__dirname, "..", "server")));
exp.get('/status', (req, res) => {
    res.send(transcodingStatus);
});
function main() {
    let port = config.httpPort || 8080;
    exp.listen(port);
    console.log("Listening on %d...", port);
    inotify.addWatch({
        path: config.inputDir,
        watch_for: inotify_1.Inotify.IN_CREATE | inotify_1.Inotify.IN_MOVED_TO,
        callback: fileChange
    });
    console.log("Watching %s...", config.inputDir);
    initialAdd();
}
function initialAdd() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("adding all files from %s", config.inputDir);
        let files = fs.readdirSync(config.inputDir);
        files = files.filter(it => fs.statSync(Path.join(config.inputDir, it)).isFile());
        files = yield asyncFilter(files, isTranscodable);
        files.forEach(addFile);
        workQueue();
    });
}
function fileChange(event) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Found file %s", event.name);
        if (yield isTranscodable(event.name)) {
            console.log("File %s has soft subs! Adding to queue", event.name);
            addFile(event.name);
            workQueue();
        }
        else {
            console.log("But it's not transcodable");
        }
    });
}
let transcodingStatus = {
    working: false,
    currentFile: "",
    currentProgress: 0,
    queue: []
};
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
    ffmpeg(input)
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
        console.log("error while transcoding %s!", anime.filename);
        console.error(err);
        resetCurrent();
        workQueue();
    })
        .on('end', () => {
        console.log("Done converting %s to %s", anime.filename, outputname);
        resetCurrent();
        workQueue();
    })
        .save(output);
}
function resetCurrent() {
    transcodingStatus.working = false;
    transcodingStatus.currentFile = "";
    transcodingStatus.currentProgress = 0;
}
function prepareConfig(config) {
    if (!config.outputDir) {
        config.outputDir = config.inputDir;
    }
}
function addFile(filename) {
    transcodingStatus.queue.push({
        filename,
        id: uuid.v4()
    });
}
function ffescape(filename) {
    return "'" + filename.replace(/'/g, "'\\''") + "'";
}
function isTranscodable(filename) {
    let filepath = Path.join(config.inputDir, filename);
    return new Promise((res, rej) => {
        ffmpeg(filepath).ffprobe((err, data) => {
            if (err) {
                return res(false);
            }
            if (data.streams.some(it => it.codec_type === "subtitle")) {
                return res(true);
            }
            else {
                return res(false);
            }
        });
    });
}
function asyncFilter(array, predicate) {
    let promises = [];
    array.forEach(val => {
        promises.push(predicate(val));
    });
    return Promise.all(promises).then(results => array.filter((val, i) => results[i]));
}
main();
