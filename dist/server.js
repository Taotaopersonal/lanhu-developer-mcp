"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanhuMcpServer = exports.Logger = void 0;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const zod_1 = require("zod");
const express_1 = __importDefault(require("express"));
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.Logger = {
    log: (...args) => { },
    error: (...args) => { },
};
class LanhuMcpServer {
    server;
    token;
    defaultDownloadDir;
    sseTransport = null;
    constructor(token, downloadDir) {
        this.token = token;
        this.defaultDownloadDir = downloadDir || "";
        this.server = new mcp_js_1.McpServer({
            name: "Figma MCP Server",
            version: "0.1.8",
        }, {
            capabilities: {
                logging: {},
                tools: {},
            },
        });
        this.registerTools();
    }
    getFileNameFromUrl(imgUrl) {
        try {
            const urlWithoutQuery = imgUrl.split('?')[0];
            const parsedUrl = new URL(urlWithoutQuery);
            const pathName = parsedUrl.pathname;
            let fileName = path.basename(pathName);
            if (!path.extname(fileName)) {
                if (urlWithoutQuery.includes('.jpg') || urlWithoutQuery.includes('.jpeg')) {
                    fileName += '.jpg';
                }
                else if (urlWithoutQuery.includes('.png')) {
                    fileName += '.png';
                }
                else if (urlWithoutQuery.includes('.gif')) {
                    fileName += '.gif';
                }
                else if (urlWithoutQuery.includes('.svg')) {
                    fileName += '.svg';
                }
                else if (urlWithoutQuery.includes('.webp')) {
                    fileName += '.webp';
                }
                else {
                    fileName += '.png';
                }
            }
            fileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
            return fileName;
        }
        catch (error) {
            return `image_${Date.now()}.png`;
        }
    }
    getSemanticFileName(imgUrl, layerName) {
        // 从 URL 中提取 hash 前6位
        const urlWithoutQuery = imgUrl.split('?')[0];
        const baseName = path.basename(urlWithoutQuery);
        const hash = baseName.replace(/^(max_|svg_)/, '').substring(0, 6);
        const prefix = baseName.startsWith('max_') ? '_max' : baseName.startsWith('svg_') ? '_svg' : '';
        // 清理图层名
        const cleanName = layerName
            ? layerName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').trim()
            : '';
        if (cleanName) {
            return `${cleanName}${prefix}_${hash}`;
        }
        return baseName; // fallback 到原始 hash 名
    }
    async downloadImage(imgUrl, downloadDir, layerName) {
        try {
            if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, { recursive: true });
            }
            else if (!fs.statSync(downloadDir).isDirectory()) {
                fs.unlinkSync(downloadDir);
                fs.mkdirSync(downloadDir, { recursive: true });
            }
            const fileName = layerName !== undefined
                ? this.getSemanticFileName(imgUrl, layerName)
                : this.getFileNameFromUrl(imgUrl);
            const filePath = path.join(downloadDir, fileName);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size === 0) {
                    fs.unlinkSync(filePath);
                }
                else {
                    return filePath;
                }
            }
            const axios = (await import('axios')).default;
            const response = await axios({
                url: imgUrl,
                method: 'GET',
                responseType: 'arraybuffer',
                headers: {
                    'Accept': 'image/*'
                }
            });
            const contentType = response.headers['content-type'];
            let finalFilePath = filePath;
            if (!path.extname(filePath) && contentType) {
                let ext = '.png';
                if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                    ext = '.jpg';
                }
                else if (contentType.includes('png')) {
                    ext = '.png';
                }
                else if (contentType.includes('gif')) {
                    ext = '.gif';
                }
                else if (contentType.includes('svg')) {
                    ext = '.svg';
                }
                else if (contentType.includes('webp')) {
                    ext = '.webp';
                }
                finalFilePath = filePath + ext;
            }
            fs.writeFileSync(finalFilePath, Buffer.from(response.data));
            return finalFilePath;
        }
        catch (error) {
            exports.Logger.error(`下载图片失败: ${imgUrl}`, error);
            throw error;
        }
    }
    isLanhuImageUrl(url) {
        // 匹配蓝湖的各种图片域名（含无扩展名的 hash URL）
        return url.includes('alipic.lanhuapp.com') ||
               url.includes('lanhu-oss-proxy.lanhuapp.com');
    }
    // 返回 Map<url, layerName>，支持语义化文件命名
    extractImageUrls(data, imgMap = new Map(), currentLayerName = '') {
        if (data === null || data === undefined) {
            return imgMap;
        }
        if (typeof data === 'string') {
            if (this.isLanhuImageUrl(data)) {
                if (!imgMap.has(data)) imgMap.set(data, currentLayerName);
            }
            else if ((data.startsWith('http://') || data.startsWith('https://')) &&
                /\.(jpg|jpeg|png|gif|svg|webp)(\?|$)/i.test(data)) {
                if (!imgMap.has(data)) imgMap.set(data, currentLayerName);
            }
            return imgMap;
        }
        if (typeof data === 'object') {
            if (Array.isArray(data)) {
                for (const item of data) {
                    this.extractImageUrls(item, imgMap, currentLayerName);
                }
            }
            else {
                // 如果当前对象有 name 字段，用它作为图层名
                const layerName = data.name || currentLayerName;
                for (const [key, value] of Object.entries(data)) {
                    if (['imageUrl', 'img', 'svgUrl', 'svg', 'image', 'url', 'src', 'background', 'icon', 'avatar', 'thumbnail', 'preview'].includes(key.toLowerCase()) &&
                        typeof value === 'string') {
                        if (value.startsWith('http://') || value.startsWith('https://')) {
                            if (!imgMap.has(value)) imgMap.set(value, layerName);
                        }
                    }
                    this.extractImageUrls(value, imgMap, layerName);
                }
            }
        }
        return imgMap;
    }
    extractImageUrlsFromString(jsonStr) {
        const imgMap = new Map();
        // 匹配蓝湖所有图片域名
        const lanhuRegex = /https:\/\/(?:alipic|lanhu-oss-proxy)\.lanhuapp\.com[^"'\s)]+/g;
        const matches = jsonStr.match(lanhuRegex) || [];
        matches.forEach(url => { if (!imgMap.has(url)) imgMap.set(url, ''); });
        return imgMap;
    }
    getRelativePath(filePath, baseDir, downloadDir) {
        const relativeDir = path.relative(baseDir, downloadDir).replace(/\\/g, '/');
        return `@/${relativeDir}/${path.basename(filePath)}`;
    }
    getAvailableDir(baseDir) {
        // 尝试创建目录，用 mkdir 作为原子操作避免竞态条件
        const tryMkdir = (dir) => {
            try {
                fs.mkdirSync(dir, { recursive: false });
                return true; // 创建成功，获得了这个目录
            } catch (e) {
                if (e.code === 'EEXIST') return false; // 目录已存在，换下一个
                // 父目录不存在，先创建父目录再重试
                if (e.code === 'ENOENT') {
                    fs.mkdirSync(path.dirname(dir), { recursive: true });
                    try {
                        fs.mkdirSync(dir, { recursive: false });
                        return true;
                    } catch (e2) {
                        if (e2.code === 'EEXIST') return false;
                        throw e2;
                    }
                }
                throw e;
            }
        };
        if (tryMkdir(baseDir)) return baseDir;
        let counter = 1;
        while (true) {
            const candidateDir = `${baseDir}_${counter}`;
            if (tryMkdir(candidateDir)) return candidateDir;
            counter++;
        }
    }
    replaceImageUrls(data, urlMap) {
        if (data === null || data === undefined) {
            return data;
        }
        if (typeof data === 'string') {
            if (urlMap.has(data)) {
                return urlMap.get(data);
            }
            return data;
        }
        if (Array.isArray(data)) {
            return data.map(item => this.replaceImageUrls(item, urlMap));
        }
        if (typeof data === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(data)) {
                result[key] = this.replaceImageUrls(value, urlMap);
            }
            return result;
        }
        return data;
    }
    compressJsonData(data, urlMap) {
        let processedData = data;
        if (urlMap) {
            processedData = this.replaceImageUrls(data, urlMap);
        }
        // 裁剪无用字段，保留属性原名（不压缩），降低模型理解成本
        const uselessTopKeys = new Set(['info', 'exVersion', 'psVersion', 'parerVersion', 'rawId', 'imgMD5', 'newSid']);
        const uselessLayerKeys = new Set([
            'sliceBackData', 'ddsImages', '_orgBounds', 'pixels',
            'generatorSettings', 'blendOptions', 'path', 'pathComponents',
            'subpathListKey', 'strokeStyle', 'strokeStyleContent'
        ]);
        const cleanObject = (obj, isTopLevel) => {
            if (Array.isArray(obj)) {
                return obj.map(item => cleanObject(item, false));
            }
            if (obj !== null && typeof obj === 'object') {
                const cleaned = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (isTopLevel && uselessTopKeys.has(key)) continue;
                    if (!isTopLevel && uselessLayerKeys.has(key)) continue;
                    cleaned[key] = cleanObject(value, false);
                }
                return cleaned;
            }
            return obj;
        };
        const cleanedData = cleanObject(processedData, true);
        return JSON.stringify(cleanedData);
    }
    isTaroProject() {
        try {
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
                return Object.keys(dependencies).some(dep => dep.startsWith('@tarojs/') || dep === 'taro');
            }
        }
        catch (error) {
            console.error('[蓝湖MCP] 检查Taro项目时出错:', error);
        }
        return false;
    }
    addRpxUnitsForTaro(data) {
        const styleProperties = [
            'top', 'left', 'bottom', 'right', 'x', 'y', 'z',
            'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
            'size', 'radius', 'r', 'diameter', 'd',
            'margin', 'padding',
            'marginTop', 'marginLeft', 'marginRight', 'marginBottom',
            'paddingTop', 'paddingLeft', 'paddingRight', 'paddingBottom',
            'spacing', 'space', 'gutter',
            'fontSize', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textIndent',
            'baselineOffset', 'leading',
            'borderWidth', 'borderRadius', 'strokeWidth', 'stroke',
            'borderTopWidth', 'borderLeftWidth', 'borderRightWidth', 'borderBottomWidth',
            'borderTopLeftRadius', 'borderTopRightRadius',
            'borderBottomLeftRadius', 'borderBottomRightRadius',
            'gap', 'rowGap', 'columnGap', 'flexBasis',
            'translateX', 'translateY', 'scale', 'rotate',
            'backgroundSize', 'outlineWidth', 'outlineOffset',
            'thickness', 'offset',
            'w', 'h', 'l', 't', 'r', 'b',
            'rad', 'sz'
        ];
        const cssFields = [
            'css', 'style', 'styles', 'styleProps', 'cssProps',
            'layoutStyle', 'containerStyle', 'textStyle', 'customStyle',
            'theme', 'themeStyles', 'variants',
            'bounds', 'frame', 'constraints', 'layout',
            'position', 'dimensions', 'rect', 'box',
            'properties', 'props', 'attributes'
        ];
        const processed = new WeakSet();
        const processObject = (obj) => {
            if (obj === null || obj === undefined || typeof obj !== 'object') {
                return obj;
            }
            if (processed.has(obj)) {
                return obj;
            }
            processed.add(obj);
            if (Array.isArray(obj)) {
                return obj.map(item => processObject(item));
            }
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                if (cssFields.includes(key) && typeof value === 'object' && value !== null) {
                    result[key] = {};
                    for (const [propKey, propValue] of Object.entries(value)) {
                        if (styleProperties.includes(propKey) && typeof propValue === 'number') {
                            result[key][propKey] = `${propValue}rpx`;
                        }
                        else {
                            result[key][propKey] = processObject(propValue);
                        }
                    }
                }
                else if (key === 'css' && typeof value === 'string') {
                    result.css = value.replace(/(\d+)px/g, '$1rpx');
                }
                else if (styleProperties.includes(key) && typeof value === 'number') {
                    result[key] = `${value}rpx`;
                }
                else {
                    result[key] = processObject(value);
                }
            }
            return result;
        };
        const processNodes = (data) => {
            if (!data) {
                return data;
            }
            let result = processObject(data);
            if (data.nodes && Array.isArray(data.nodes)) {
                result.nodes = data.nodes.map((node) => {
                    if (node === null || node === undefined) {
                        return node;
                    }
                    let processedNode = { ...node };
                    if (processedNode.css && typeof processedNode.css === 'string') {
                        processedNode.css = processedNode.css.replace(/(\d+)px/g, '$1rpx');
                    }
                    for (const [key, value] of Object.entries(processedNode)) {
                        if (typeof value === 'object' && value !== null) {
                            processedNode[key] = processObject(value);
                        }
                        else if (styleProperties.includes(key) && typeof value === 'number') {
                            processedNode[key] = `${value}rpx`;
                        }
                    }
                    return processedNode;
                });
            }
            const debugSample = { ...result };
            if (debugSample.nodes && debugSample.nodes.length > 0) {
                debugSample.nodes = [debugSample.nodes[0]];
            }
            return result;
        };
        try {
            console.time('[蓝湖MCP] 样式单位转换耗时');
            const result = processNodes(data);
            console.timeEnd('[蓝湖MCP] 样式单位转换耗时');
            return result;
        }
        catch (error) {
            console.error('[蓝湖MCP] 样式单位转换出错:', error);
            return data;
        }
    }
    registerTools() {
        this.server.tool("get_lanhu_data", "获取整个蓝湖文件的布局信息", {
            project_id: zod_1.z
                .string()
                .describe("要获取的蓝湖文件的key，通常作为URL参数project_id=<nodeId>找到，如果提供了则始终使用"),
            image_id: zod_1.z
                .string()
                .optional()
                .describe("要获取的节点ID，通常作为URL参数image_id=<nodeId>找到，如果提供了则始终使用"),
            download_dir: zod_1.z
                .string()
                .optional()
                .describe("自定义图片下载目录（相对于项目根目录），如 'src/assets/MyDesign'。不传则使用默认目录。如果目录已存在会自动创建带数字后缀的子目录以支持并行下载"),
            includes: zod_1.z
                .array(zod_1.z.enum(['json', 'slices']))
                .optional()
                .describe("控制下载内容。默认不传等同于 ['json','slices'] 全部下载。传 ['json'] 则只下载标注数据不下载切图。可选值: json(标注数据), slices(切图)")
        }, async ({ project_id, image_id, download_dir, includes }) => {
            try {
                exports.Logger.log(`获取蓝湖数据开始`);
                console.log("[蓝湖MCP] 正在请求蓝湖API...");
                const axios = (await import('axios')).default;
                const response = await axios.get(`https://lanhuapp.com/api/project/image`, {
                    params: { image_id: image_id, project_id: project_id },
                    headers: { 'Cookie': this.token }
                });
                if (!response.data.result?.versions?.[0]?.json_url) {
                    throw new Error('蓝湖API返回数据格式不正确，无法获取JSON URL');
                }
                // 尝试从 API 响应中获取设计稿名称
                const designName = response.data.result?.name || response.data.result?.title || '';
                const sanitizedName = designName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').trim();
                if (sanitizedName) {
                    console.log(`[蓝湖MCP] 设计稿名称: ${designName}`);
                }
                console.log("[蓝湖MCP] 正在获取设计稿JSON数据...");
                const jsonResponse = await axios.get(response.data.result.versions[0].json_url);
                const urlMap = new Map();
                const rootDir = process.cwd();
                // 确定基础下载目录：参数 > 服务器配置 > 默认值
                const baseRelDir = download_dir || this.defaultDownloadDir || 'src/assets/LanHuImgFile';
                // 如果有设计稿名称，用名称作为子目录；否则用基础目录
                const targetDir = sanitizedName
                    ? path.join(rootDir, baseRelDir, sanitizedName)
                    : path.join(rootDir, baseRelDir);
                // 并行安全：getAvailableDir 会原子创建目录，避免竞态条件
                const actualDownloadDir = this.getAvailableDir(targetDir);
                // 判断是否需要下载切图：默认全部下载，传了 includes 且不含 'slices' 则跳过
                const shouldDownloadSlices = !includes || includes.length === 0 || includes.includes('slices');
                if (shouldDownloadSlices) {
                    try {
                        const imgMap = this.extractImageUrls(jsonResponse.data);
                        const jsonStr = JSON.stringify(jsonResponse.data);
                        const strImgMap = this.extractImageUrlsFromString(jsonStr);
                        strImgMap.forEach((name, url) => { if (!imgMap.has(url)) imgMap.set(url, name); });
                        const totalImages = imgMap.size;
                        console.log(`[蓝湖MCP] 找到 ${totalImages} 张图片素材`);
                        if (totalImages > 0) {
                            console.log(`[蓝湖MCP] 开始下载图片到: ${actualDownloadDir}`);
                            let successCount = 0;
                            let failCount = 0;
                            let currentIndex = 0;
                            const downloadPromises = Array.from(imgMap.entries()).map(async ([imgUrl, layerName]) => {
                                try {
                                    currentIndex++;
                                    console.log(`[蓝湖MCP] 开始下载第 ${currentIndex}/${totalImages} 张图片...`);
                                    const filePath = await this.downloadImage(imgUrl, actualDownloadDir, layerName);
                                    const relativePath = this.getRelativePath(filePath, rootDir, actualDownloadDir);
                                    urlMap.set(imgUrl, relativePath);
                                    successCount++;
                                    return { success: true, url: imgUrl, path: filePath };
                                }
                                catch (error) {
                                    failCount++;
                                    return { success: false, url: imgUrl, error };
                                }
                            });
                            await Promise.all(downloadPromises);
                            console.log(`[蓝湖MCP] 图片下载完成，成功: ${successCount}，失败: ${failCount}`);
                        }
                    }
                    catch (error) {
                        console.error("[蓝湖MCP] 图片下载过程中出错:", error);
                    }
                } else {
                    console.log("[蓝湖MCP] 跳过切图下载（includes 不含 slices）");
                    if (!fs.existsSync(actualDownloadDir)) fs.mkdirSync(actualDownloadDir, { recursive: true });
                }
                console.log("[蓝湖MCP] 数据获取成功，正在处理返回结果...");
                console.log("[蓝湖MCP] 替换图片URL为本地路径...");
                let processedData = jsonResponse.data;
                if (urlMap.size > 0) {
                    processedData = this.replaceImageUrls(processedData, urlMap);
                }
                const isTaro = this.isTaroProject();
                if (isTaro) {
                    console.log("[蓝湖MCP] 检测到Taro项目，正在转换样式单位为rpx...");
                    processedData = this.addRpxUnitsForTaro(processedData);
                }
                try {
                    // JSON 数据保存到下载目录内部
                    const outputFilePath = path.join(actualDownloadDir, 'lanhu-data.json');
                    fs.writeFileSync(outputFilePath, this.compressJsonData(processedData), 'utf8');
                    console.log(`[蓝湖MCP] 由于内容过长，已将数据保存到文件: ${outputFilePath}`);
                    return {
                        content: [{
                                type: "text",
                                text: `数据已保存到文件: ${outputFilePath}`
                            }]
                    };
                }
                catch (fileError) {
                    console.error("[蓝湖MCP] 保存数据到文件时出错:", fileError);
                    return {
                        content: [{
                                type: "text",
                                text: `保存文件失败，尝试直接返回: ${fileError}`
                            }]
                    };
                }
            }
            catch (error) {
                exports.Logger.error(`获取文件时出错:`, error);
                return {
                    content: [{ type: "text", text: `获取文件时出错: ${error}` }],
                };
            }
        });
        // ===== get_lanhu_designs: 获取设计图列表 =====
        this.server.tool("get_lanhu_designs", "获取蓝湖项目的设计图列表（名称、尺寸、ID），用于选择要下载的设计稿", {
            project_id: zod_1.z.string().describe("蓝湖项目ID，URL参数 project_id=<id> 或 pid=<id>"),
            team_id: zod_1.z.string().optional().describe("团队ID，URL参数 tid=<id>。不传默认空字符串")
        }, async ({ project_id, team_id }) => {
            try {
                console.log("[蓝湖MCP] 正在获取设计图列表...");
                const axios = (await import('axios')).default;
                const resp = await axios.get('https://lanhuapp.com/api/project/images', {
                    params: { project_id, team_id: team_id || '', dds_status: 1, position: 1, show_cb_src: 1, comment: 1 },
                    headers: { 'Cookie': this.token }
                });
                if (resp.data.code !== '00000') {
                    return { content: [{ type: "text", text: `蓝湖API错误: ${resp.data.msg || 'Unknown'}` }] };
                }
                const projectData = resp.data.data || {};
                const images = projectData.images || [];
                const designs = images.map((img, i) => ({
                    index: i + 1, id: img.id, name: img.name,
                    width: img.width, height: img.height, url: img.url,
                    update_time: img.update_time
                }));
                console.log(`[蓝湖MCP] 找到 ${designs.length} 个设计图`);
                return { content: [{ type: "text", text: JSON.stringify({ status: 'success', project_name: projectData.name, total_designs: designs.length, designs }, null, 2) }] };
            } catch (error) {
                return { content: [{ type: "text", text: `获取设计图列表出错: ${error}` }] };
            }
        });
        // ===== get_lanhu_sector_designs: 获取分组下的设计图列表 =====
        this.server.tool("get_lanhu_sector_designs", "获取蓝湖项目指定分组(sector)下的设计图列表。传 sector_name='all' 可列出所有分组概览", {
            project_id: zod_1.z.string().describe("蓝湖项目ID，URL参数 project_id=<id> 或 pid=<id>"),
            team_id: zod_1.z.string().optional().describe("团队ID，URL参数 tid=<id>。不传默认空字符串"),
            sector_name: zod_1.z.string().describe("分组名称。传 'all' 列出所有分组概览，传具体名称如 '莓好时光' 获取该分组下的设计图")
        }, async ({ project_id, team_id, sector_name }) => {
            try {
                const axios = (await import('axios')).default;
                const tidParam = team_id || '';
                // 1. 获取分组列表
                console.log("[蓝湖MCP] 正在获取分组列表...");
                const sectorsResp = await axios.get('https://lanhuapp.com/api/project/project_sectors', {
                    params: { project_id },
                    headers: { 'Cookie': this.token }
                });
                if (sectorsResp.data.code !== '00000') {
                    return { content: [{ type: "text", text: `蓝湖API错误: ${sectorsResp.data.msg || 'Unknown'}` }] };
                }
                const sectors = (sectorsResp.data.data || {}).sectors || [];
                if (sectors.length === 0) {
                    return { content: [{ type: "text", text: '该项目没有分组' }] };
                }
                // 传 'all' 时返回分组概览
                if (sector_name.trim().toLowerCase() === 'all') {
                    const overview = sectors.map(s => ({ name: s.name, design_count: (s.images || []).length }));
                    return { content: [{ type: "text", text: JSON.stringify({ status: 'success', project_id, total_sectors: sectors.length, sectors: overview }, null, 2) }] };
                }
                // 2. 查找目标分组
                const target = sectors.find(s => s.name === sector_name);
                if (!target) {
                    const available = sectors.map(s => s.name);
                    return { content: [{ type: "text", text: JSON.stringify({ status: 'error', message: `分组 "${sector_name}" 未找到`, available_sectors: available }, null, 2) }] };
                }
                const imageIds = target.images || [];
                if (imageIds.length === 0) {
                    return { content: [{ type: "text", text: JSON.stringify({ status: 'success', sector_name, total_designs: 0, designs: [] }, null, 2) }] };
                }
                // 3. 获取全量设计图列表以匹配 name
                console.log("[蓝湖MCP] 正在获取设计图列表以匹配分组...");
                const imagesResp = await axios.get('https://lanhuapp.com/api/project/images', {
                    params: { project_id, team_id: tidParam, dds_status: 1, position: 1, show_cb_src: 1, comment: 1 },
                    headers: { 'Cookie': this.token }
                });
                const allImages = (imagesResp.data.data || {}).images || [];
                const idToDesign = {};
                allImages.forEach(img => { idToDesign[img.id] = img; });
                // 4. 构建结果
                const designList = imageIds.map(imgId => {
                    const design = idToDesign[imgId];
                    return {
                        id: imgId,
                        name: design ? design.name : imgId,
                        url: `https://lanhuapp.com/web/#/item/project/detailDetach?tid=${tidParam}&pid=${project_id}&image_id=${imgId}&project_id=${project_id}&fromEditor=true&type=image`,
                        preview_url: design ? design.url : null
                    };
                });
                console.log(`[蓝湖MCP] 分组 "${sector_name}" 下找到 ${designList.length} 个设计图`);
                return { content: [{ type: "text", text: JSON.stringify({ status: 'success', sector_name, total_designs: designList.length, designs: designList }, null, 2) }] };
            } catch (error) {
                return { content: [{ type: "text", text: `获取分组设计图出错: ${error}` }] };
            }
        });
        // ===== get_lanhu_preview: 下载设计图预览大图 =====
        this.server.tool("get_lanhu_preview", "下载蓝湖设计图的预览大图（preview.png）到本地，用于查看完整设计效果", {
            project_id: zod_1.z.string().describe("蓝湖项目ID"),
            team_id: zod_1.z.string().optional().describe("团队ID，不传默认空字符串"),
            design_names: zod_1.z.string().optional().describe("要下载的设计图名称，逗号分隔。传 'all' 或不传则下载全部。注意：有重名时请用 design_ids 代替"),
            design_ids: zod_1.z.string().optional().describe("要下载的设计图ID，逗号分隔。优先级高于 design_names，用于精确筛选（避免重名问题）。ID 从 get_lanhu_sector_designs 或 get_lanhu_designs 获取"),
            download_dir: zod_1.z.string().optional().describe("下载目录（相对于项目根目录），如 'view/activity/xxx/design-assets'。不传则用默认目录")
        }, async ({ project_id, team_id, design_names, design_ids, download_dir }) => {
            try {
                console.log("[蓝湖MCP] 正在获取设计图列表...");
                const axios = (await import('axios')).default;
                const resp = await axios.get('https://lanhuapp.com/api/project/images', {
                    params: { project_id, team_id: team_id || '', dds_status: 1, position: 1, show_cb_src: 1, comment: 1 },
                    headers: { 'Cookie': this.token }
                });
                if (resp.data.code !== '00000') {
                    return { content: [{ type: "text", text: `蓝湖API错误: ${resp.data.msg || 'Unknown'}` }] };
                }
                const images = (resp.data.data || {}).images || [];
                console.log(`[蓝湖MCP] 项目共 ${images.length} 个设计图`);
                let targets = images;
                // 优先用 ID 筛选（精确，无重名问题）
                if (design_ids && design_ids.trim()) {
                    const idSet = new Set(design_ids.split(',').map(n => n.trim()));
                    console.log(`[蓝湖MCP] 按 ID 筛选，传入 ${idSet.size} 个 ID`);
                    targets = images.filter(img => idSet.has(img.id));
                    console.log(`[蓝湖MCP] 匹配到 ${targets.length} 个设计图`);
                    if (targets.length === 0) {
                        return { content: [{ type: "text", text: `未找到匹配的设计图ID。` }] };
                    }
                } else if (design_names && design_names.toLowerCase() !== 'all') {
                    const nameSet = new Set(design_names.split(',').map(n => n.trim()));
                    targets = images.filter(img => nameSet.has(img.name));
                    if (targets.length === 0) {
                        return { content: [{ type: "text", text: `未找到匹配的设计图。可用: ${images.map(i => i.name).join(', ')}` }] };
                    }
                }
                const rootDir = process.cwd();
                const previewDir = path.join(rootDir, download_dir || this.defaultDownloadDir || 'src/assets/LanHuPreview');
                if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });
                console.log(`[蓝湖MCP] 开始下载 ${targets.length} 张预览图到: ${previewDir}`);
                const results = await Promise.all(targets.map(async (design) => {
                    try {
                        const imgUrl = design.url.split('?')[0];
                        const imgResp = await axios({ url: imgUrl, method: 'GET', responseType: 'arraybuffer', headers: { 'Accept': 'image/*' } });
                        const safeName = design.name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').trim();
                        const filepath = path.join(previewDir, `${safeName}.png`);
                        fs.writeFileSync(filepath, Buffer.from(imgResp.data));
                        console.log(`[蓝湖MCP] ✓ ${design.name}`);
                        return { success: true, name: design.name, path: filepath };
                    } catch (err) {
                        console.error(`[蓝湖MCP] ✗ ${design.name}: ${err}`);
                        return { success: false, name: design.name, error: String(err) };
                    }
                }));
                const ok = results.filter(r => r.success).length;
                const fail = results.filter(r => !r.success).length;
                let summary = `预览图下载完成: ${ok} 成功, ${fail} 失败\n目录: ${previewDir}\n\n`;
                for (const r of results) {
                    summary += r.success ? `✓ ${r.name} -> ${r.path}\n` : `✗ ${r.name}: ${r.error}\n`;
                }
                return { content: [{ type: "text", text: summary }] };
            } catch (error) {
                return { content: [{ type: "text", text: `下载预览图出错: ${error}` }] };
            }
        });
    }
    async connect(transport) {
        await this.server.connect(transport);
        exports.Logger.log = (...args) => {
            this.server.server.sendLoggingMessage({
                level: "info",
                data: args,
            });
        };
        exports.Logger.error = (...args) => {
            this.server.server.sendLoggingMessage({
                level: "error",
                data: args,
            });
        };
        exports.Logger.log("服务器已连接并准备处理请求");
    }
    async startHttpServer(port) {
        const app = (0, express_1.default)();
        app.get("/sse", async (req, res) => {
            console.log("已建立新的SSE连接");
            this.sseTransport = new sse_js_1.SSEServerTransport("/messages", res);
            await this.server.connect(this.sseTransport);
        });
        app.post("/messages", async (req, res) => {
            if (!this.sseTransport) {
                res.sendStatus(400);
                return;
            }
            await this.sseTransport.handlePostMessage(req, res);
        });
        exports.Logger.log = console.log;
        exports.Logger.error = console.error;
        const server = app.listen(port, () => {
            exports.Logger.log(`HTTP服务器监听端口 ${port}`);
            exports.Logger.log(`SSE端点可用于 http://localhost:${port}/sse`);
            exports.Logger.log(`消息端点可用于 http://localhost:${port}/messages`);
        });
        server.requestTimeout = 30 * 60 * 1000;
        server.headersTimeout = (30 * 60 * 1000) + 1000;
    }
}
exports.LanhuMcpServer = LanhuMcpServer;
//# sourceMappingURL=server.js.map