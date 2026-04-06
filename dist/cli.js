#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const dotenv_1 = require("dotenv");
const index_1 = require("./index");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(process.cwd(), ".env") });
(0, index_1.startServer)().catch((error) => {
    if (error instanceof Error) {
        console.error("启动服务器失败:", error.message);
    }
    else {
        console.error("启动服务器失败，未知错误:", error);
    }
    process.exit(1);
});
//# sourceMappingURL=cli.js.map