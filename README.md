# @kangtao/lanhu-developer-mcp

基于 [lanhu-developer-mcp](https://www.npmjs.com/package/lanhu-developer-mcp) v1.0.6 的增强版本，解决并行下载冲突和目录不可配置的问题。

## 相比原版的改进

### 1. 自定义下载目录

通过工具参数 `download_dir` 指定每次调用的下载路径：

```json
{
  "project_id": "xxx",
  "image_id": "yyy",
  "download_dir": "src/assets/MyDesign"
}
```

### 2. 全局默认目录配置

通过 CLI 参数或环境变量配置默认下载目录：

```bash
# CLI 参数
lanhu-developer-mcp --download-dir "src/assets/CustomDir"

# 环境变量
LANHU_DOWNLOAD_DIR=src/assets/CustomDir
```

优先级：工具参数 `download_dir` > CLI `--download-dir` > 环境变量 `LANHU_DOWNLOAD_DIR` > 默认值 `src/assets/LanHuImgFile`

### 3. 并行下载安全

当目标目录已存在时，自动创建带数字后缀的目录，避免并行下载冲突：

```
src/assets/LanHuImgFile/     ← 第 1 次下载
src/assets/LanHuImgFile_1/   ← 第 2 次并行下载
src/assets/LanHuImgFile_2/   ← 第 3 次并行下载
```

### 4. 动态输出路径

- 图片引用路径根据实际下载目录动态生成（不再硬编码 `@/src/assets/LanHuImgFile/`）
- JSON 数据文件名根据目录名动态生成（如 `MyDesign_PageData.json`）

## 安装

```bash
npm install -g @kangtao/lanhu-developer-mcp
```

## 使用

与原版相同，额外支持 `--download-dir` 参数：

```bash
# stdio 模式（MCP 集成）
lanhu-developer-mcp --stdio --token YOUR_TOKEN

# HTTP 模式
lanhu-developer-mcp --token YOUR_TOKEN --port 8000 --download-dir src/assets/MyDesign
```

### MCP 配置示例

```json
{
  "mcpServers": {
    "lanhu-developer-mcp": {
      "command": "npx",
      "args": ["-y", "@kangtao/lanhu-developer-mcp", "--stdio"],
      "env": {
        "LANHU_TOKEN": "<your-lanhu-token>",
        "LANHU_DOWNLOAD_DIR": "src/assets/LanHuImgFile"
      }
    }
  }
}
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LANHU_TOKEN` | 蓝湖用户 Token | 必填 |
| `PORT` | HTTP 服务端口 | 3333 |
| `LANHU_DOWNLOAD_DIR` | 默认图片下载目录 | `src/assets/LanHuImgFile` |

## 可用工具

### get_lanhu_data

获取蓝湖设计稿的布局信息。

参数：

- `project_id`（字符串，必需）：蓝湖项目 ID
- `image_id`（字符串，可选）：设计稿节点 ID
- `download_dir`（字符串，可选）：自定义图片下载目录（相对于项目根目录）

## License

MIT
