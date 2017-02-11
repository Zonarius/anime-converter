"use strict";
const inotify_1 = require("inotify");
const Path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const express = require("express");
const nunjucks = require("nunjucks");
const inotify = new inotify_1.Inotify();
const config = require('../config.json');
const exp = express();
prepareConfig(config);
nunjucks.configure(__dirname, {
    express: exp
});
exp.get('/', (req, res) => {
    res.render("status.html", { transcode: transcodingStatus });
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
    console.log("adding all files from %s", config.inputDir);
    let files = fs.readdirSync(config.inputDir);
    transcodingStatus.transcodingQueue.push(...files);
    workQueue();
}
function fileChange(event) {
    console.log("Found file %s", event.name);
    let filepath = Path.join(config.inputDir, event.name);
    ffmpeg(filepath).ffprobe((err, data) => {
        if (err) {
            console.log("But it doesn't seem to be a video");
            return;
        }
        if (data.streams.some(it => it.codec_type === "subtitle")) {
            console.log("File %s has soft subs! Adding to queue", event.name);
            transcodingStatus.transcodingQueue.push(event.name);
            workQueue();
        }
        else {
            console.log("But it has no subtitles!");
        }
    });
}
let transcodingStatus = {
    working: false,
    currentFile: "",
    currentProgress: 0,
    transcodingQueue: []
};
function workQueue() {
    if (transcodingStatus.working) {
        return;
    }
    if (transcodingStatus.transcodingQueue.length === 0) {
        console.log("Queue is empty! Nothing to do...");
        return;
    }
    let filename = transcodingStatus.transcodingQueue.splice(0, 1)[0];
    let input = Path.join(config.inputDir, filename);
    let outputname = Path.parse(filename).name + ".mp4";
    let output = Path.join(config.outputDir, outputname);
    if (fs.existsSync(output)) {
        console.log("Ignoring file %s -> %s as it already exists!", filename, outputname);
        workQueue();
        return;
    }
    ffmpeg(input)
        .videoFilter({
        filter: "subtitles",
        options: input
    })
        .on('start', () => {
        transcodingStatus.working = true;
        transcodingStatus.currentFile = outputname;
        console.log("Starting to convert %s to %s", filename, outputname);
    })
        .on('progress', (progress) => {
        transcodingStatus.currentProgress = progress.percent;
    })
        .on('error', (err) => {
        console.log("error while transcoding %s!", filename);
        console.error(err);
        resetCurrent();
        workQueue();
    })
        .on('end', () => {
        console.log("Done converting %s to %s", filename, outputname);
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
main();
