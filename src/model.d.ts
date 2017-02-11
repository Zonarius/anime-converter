interface Config {
  inputDir: string;
  outputDir?: string;
  httpPort: number;
}

interface Status {
  working: boolean,
  currentFile: string,
  currentProgress: number,
  queue: QueuedAnime[]
}

interface QueuedAnime {
  filename: string,
  id: string
}