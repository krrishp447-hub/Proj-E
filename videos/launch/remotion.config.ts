import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
// three.js needs WebGL in headless Chrome.
Config.setChromiumOpenGlRenderer("angle");
Config.setCodec("h264");
Config.setCrf(16);
