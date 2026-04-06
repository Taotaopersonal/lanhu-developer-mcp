"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerConfig = getServerConfig;
const dotenv_1 = require("dotenv");
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
(0, dotenv_1.config)();
function maskApiKey(key) {
    if (key.length <= 4)
        return "****";
    return `****${key.slice(-4)}`;
}
function getServerConfig(isStdioMode) {
    const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .options({
        token: {
            type: "string",
            description: "蓝湖用户Token",
        },
        port: {
            type: "number",
            description: "服务器运行端口",
        },
        "download-dir": {
            type: "string",
            description: "默认图片下载目录（相对于项目根目录），默认 src/assets/LanHuImgFile",
        },
    })
        .help()
        .parseSync();
    const config = {
        token: "",
        port: 3333,
        downloadDir: "",
        configSources: {
            token: "default",
            port: "default",
            downloadDir: "default",
        },
    };
    if (argv.token) {
        config.token = argv.token;
        config.configSources.token = "cli";
    }
    else if (process.env.LANHU_TOKEN) {
        config.token = process.env.LANHU_TOKEN;
        config.configSources.token = "env";
    }
    if (argv.port) {
        config.port = argv.port;
        config.configSources.port = "cli";
    }
    else if (process.env.PORT) {
        config.port = parseInt(process.env.PORT, 10);
        config.configSources.port = "env";
    }
    if (argv["download-dir"]) {
        config.downloadDir = argv["download-dir"];
        config.configSources.downloadDir = "cli";
    }
    else if (process.env.LANHU_DOWNLOAD_DIR) {
        config.downloadDir = process.env.LANHU_DOWNLOAD_DIR;
        config.configSources.downloadDir = "env";
    }
    if (!config.token) {
        console.error("需要提供token（通过.env文件填写）");
        process.exit(1);
    }
    if (!isStdioMode) {
        console.log("\n配置信息:");
        console.log(`- token: ${maskApiKey(config.token)} (来源: ${config.configSources.token})`);
        console.log(`- PORT: ${config.port} (来源: ${config.configSources.port})`);
        console.log();
    }
    return config;
}
//# sourceMappingURL=config.js.map