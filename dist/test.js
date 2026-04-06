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
const server_1 = require("./server");
const config_1 = require("./config");
const dotenv_1 = __importDefault(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
dotenv_1.default.config();
server_1.Logger.log = console.log;
server_1.Logger.error = console.error;
function getFileNameFromUrl(imgUrl) {
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
function getRelativePath(filePath, baseDir) {
    const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    return `@/src/assets/LanHuImgFile/${path.basename(filePath)}`;
}
async function downloadImage(imgUrl, downloadDir) {
    try {
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }
        else if (!fs.statSync(downloadDir).isDirectory()) {
            fs.unlinkSync(downloadDir);
            fs.mkdirSync(downloadDir, { recursive: true });
        }
        const fileName = getFileNameFromUrl(imgUrl);
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
        const response = await (0, axios_1.default)({
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
        console.error(`下载图片失败: ${imgUrl}`, error);
        throw error;
    }
}
function replaceImageUrls(data, urlMap) {
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
        return data.map(item => replaceImageUrls(item, urlMap));
    }
    if (typeof data === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(data)) {
            result[key] = replaceImageUrls(value, urlMap);
        }
        return result;
    }
    return data;
}
function extractImageUrls(data, imgUrls = new Set()) {
    if (data === null || data === undefined) {
        return imgUrls;
    }
    if (typeof data === 'string') {
        if (data.includes('https://alipic.lanhuapp.com')) {
            imgUrls.add(data);
        }
        else if ((data.startsWith('http://') || data.startsWith('https://')) &&
            /\.(jpg|jpeg|png|gif|svg|webp)(\?|$)/i.test(data)) {
            imgUrls.add(data);
        }
        return imgUrls;
    }
    if (typeof data === 'object') {
        if (Array.isArray(data)) {
            for (const item of data) {
                extractImageUrls(item, imgUrls);
            }
        }
        else {
            for (const [key, value] of Object.entries(data)) {
                if (['imageUrl', 'img', 'svgUrl', 'svg', 'image', 'url', 'src', 'background', 'icon', 'avatar', 'thumbnail', 'preview'].includes(key.toLowerCase()) &&
                    typeof value === 'string') {
                    if (value.startsWith('http://') || value.startsWith('https://')) {
                        imgUrls.add(value);
                    }
                }
                extractImageUrls(value, imgUrls);
            }
        }
    }
    return imgUrls;
}
function isTaroProject() {
    console.log('[测试] 强制启用Taro样式单位转换功能...');
    try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            return Object.keys(dependencies).some(dep => dep.startsWith('@tarojs/') || dep === 'taro');
        }
    }
    catch (error) {
        console.error('[测试] 检查Taro项目时出错:', error);
    }
    return false;
}
function addRpxUnitsForTaro(data) {
    console.log('[测试] 样式转换前数据示例:', JSON.stringify(data).substring(0, 200) + '...');
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
        console.log('[测试] 样式转换后数据示例:', JSON.stringify(debugSample).substring(0, 200) + '...');
        return result;
    };
    try {
        console.time('[测试] 样式单位转换耗时');
        const result = processNodes(data);
        console.timeEnd('[测试] 样式单位转换耗时');
        return result;
    }
    catch (error) {
        console.error('[测试] 样式单位转换出错:', error);
        return data;
    }
}
async function testGetLanhuData() {
    try {
        const config = (0, config_1.getServerConfig)(false);
        if (!config.token) {
            console.error('错误: 缺少蓝湖Token，请在.env文件中设置LANHU_TOKEN或使用--token参数');
            process.exit(1);
        }
        console.log('使用Token:', config.token.substring(0, 5) + '...');
        const server = new server_1.LanhuMcpServer(config.token);
        const projectId = '71270273-68a9-47bd-b0f3-d84e099020ba';
        const imageId = 'a16d4f4c-7297-44c6-a934-64b4ccc06695';
        console.log(`[测试] 开始测试蓝湖API获取数据，项目ID: ${projectId}, 设计稿ID: ${imageId}`);
        const response = await axios_1.default.get(`https://lanhuapp.com/api/project/image`, {
            params: { image_id: imageId, project_id: projectId },
            headers: { 'Cookie': config.token }
        });
        console.log('[测试] API响应状态:', response.status);
        if (!response.data.result?.versions?.[0]?.json_url) {
            console.error('错误: 蓝湖API返回数据格式不正确，无法获取JSON URL');
            process.exit(1);
        }
        const jsonUrl = response.data.result.versions[0].json_url;
        console.log('[测试] 获取到JSON URL');
        const jsonResponse = await axios_1.default.get(jsonUrl);
        console.log('[测试] 成功获取JSON数据');
        console.log('[测试] 原始JSON数据示例:', JSON.stringify(jsonResponse.data).slice(0, 500) + '...');
        const jsonStr = JSON.stringify(jsonResponse.data);
        const containsTopLeft = jsonStr.includes('"top":') || jsonStr.includes('"left":');
        const containsBounds = jsonStr.includes('"bounds":');
        const containsStyle = jsonStr.includes('"style":') || jsonStr.includes('"css":');
        console.log('[测试] 数据包含样式属性检查:', {
            '包含top/left属性': containsTopLeft,
            '包含bounds对象': containsBounds,
            '包含style/css属性': containsStyle
        });
        const urlMap = new Map();
        if (jsonResponse.data.nodes && Array.isArray(jsonResponse.data.nodes)) {
            console.log('[测试] 设计稿节点数量:', jsonResponse.data.nodes.length);
        }
        console.log('[测试] 开始提取图片URL...');
        const lanhuRegex = /https:\/\/alipic\.lanhuapp\.com[^"'\s)]+/g;
        const lanhuMatches = jsonStr.match(lanhuRegex) || [];
        const imgUrls = extractImageUrls(jsonResponse.data);
        lanhuMatches.forEach(url => imgUrls.add(url));
        const totalImages = imgUrls.size;
        console.log(`[测试] 找到 ${totalImages} 张图片素材`);
        if (totalImages > 0) {
            const rootDir = process.cwd();
            const srcDir = path.join(rootDir, 'src');
            const assetsDir = path.join(srcDir, 'assets');
            const downloadDir = path.join(assetsDir, 'LanHuImgFile');
            if (!fs.existsSync(srcDir)) {
                fs.mkdirSync(srcDir, { recursive: true });
            }
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }
            console.log(`[测试] 开始下载图片到: ${downloadDir}`);
            let successCount = 0;
            let failCount = 0;
            let currentIndex = 0;
            for (const imgUrl of imgUrls) {
                try {
                    currentIndex++;
                    console.log(`[测试] 开始下载第 ${currentIndex}/${totalImages} 张图片...`);
                    const filePath = await downloadImage(imgUrl, downloadDir);
                    const relativePath = getRelativePath(filePath, rootDir);
                    urlMap.set(imgUrl, relativePath);
                    successCount++;
                }
                catch (error) {
                    console.error(`[测试] 下载失败: ${imgUrl}`);
                    failCount++;
                }
            }
            console.log(`[测试] 图片下载完成，成功: ${successCount}，失败: ${failCount}`);
            console.log('[测试] 替换图片URL为本地路径...');
            let processedData = replaceImageUrls(jsonResponse.data, urlMap);
            console.log("[测试] 开始转换样式单位为rpx...");
            processedData = addRpxUnitsForTaro(processedData);
            const originalOutputPath = path.join(process.cwd(), 'original_data.json');
            fs.writeFileSync(originalOutputPath, JSON.stringify(jsonResponse.data, null, 2));
            console.log(`[测试] 原始数据已保存到: ${originalOutputPath}`);
            const taroOutputPath = path.join(process.cwd(), 'taro_test_output.json');
            fs.writeFileSync(taroOutputPath, JSON.stringify(processedData, null, 2));
            console.log(`[测试] Taro样式转换后的数据已保存到: ${taroOutputPath}`);
            const testOutputPath = path.join(process.cwd(), 'test_output.json');
            fs.writeFileSync(testOutputPath, JSON.stringify(processedData, null, 2));
            console.log(`[测试] 最终处理后的数据已保存到: ${testOutputPath}`);
        }
        console.log('[测试] 测试完成');
    }
    catch (error) {
        console.error('[测试] 测试过程中发生错误:', error);
    }
}
testGetLanhuData().catch(console.error);
//# sourceMappingURL=test.js.map