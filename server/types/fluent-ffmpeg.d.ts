declare module 'fluent-ffmpeg' {
  function ffmpeg(input?: string | ReadableStream): FfmpegCommand;
  
  namespace ffmpeg {
    function setFfmpegPath(path: string): void;
    function setFfprobePath(path: string): void;
    function getAvailableFormats(callback: (err: any, formats: any) => void): void;
  }

  interface FfmpegCommand {
    input(input: string | ReadableStream): FfmpegCommand;
    output(output: string | WritableStream): FfmpegCommand;
    outputOptions(options: string[]): FfmpegCommand;
    audioCodec(codec: string): FfmpegCommand;
    videoCodec(codec: string): FfmpegCommand;
    format(format: string): FfmpegCommand;
    on(event: string, callback: (...args: any[]) => void): FfmpegCommand;
    run(): void;
  }
  
  export = ffmpeg;
}