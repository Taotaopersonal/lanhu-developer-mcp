"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const server_1 = require("./server");
const config_1 = require("./config");
async function startServer() {
    const isStdioMode = process.env.NODE_ENV === "cli" || process.argv.includes("--stdio");
    const config = (0, config_1.getServerConfig)(isStdioMode);
    const server = new server_1.LanhuMcpServer(config.token, config.downloadDir);
    if (isStdioMode) {
        const transport = new stdio_js_1.StdioServerTransport();
        await server.connect(transport);
    }
    else {
        console.log(`初始化蓝湖 MCP服务器，HTTP模式，端口 ${config.port}...`);
        await server.startHttpServer(config.port);
    }
}
if (require.main === module) {
    startServer().catch((error) => {
        console.error("启动服务器失败:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map