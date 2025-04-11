# 接口信息 MCP 服务器

这是一个基于 Model Context Protocol 的服务器，用于获取和格式化接口信息。

## 安装

```bash
# 克隆仓库
git clone <repository-url>

# 进入项目目录
cd InterfaceInfoMcp

# 安装依赖
npm install
```

## 功能

该 MCP 服务器提供以下工具：

1. **getAllInterfaceInfo** - 一次性获取接口的所有信息（标题、路径、方法、请求参数和返回结构）
2. **getInterfaceTitle** - 获取接口的标题、路径和方法信息
3. **getInterfaceInfo** - 获取接口的基本信息，包括路径、方法、请求参数和返回结构
4. **formatInterfaceParams** - 格式化接口的请求参数为 Markdown 表格
5. **formatResponseStructure** - 格式化接口的返回结构

## 使用方法

### 启动服务器

```bash
npm start
```

### 与服务器交互

你可以使用支持 MCP 协议的客户端与服务器交互。例如，运行提供的客户端示例：

```bash
node client-example.js
```

### 使用方式

1. 首先，你需要从浏览器中获取接口文档的 URL 和 Cookie
2. URL 格式应为：`https://weapons.ke.com/project/{projectId}/interface/api/{interfaceId}`
3. Cookie 值从浏览器开发者工具中获取

服务器会自动从 URL 中解析出接口 ID，然后使用该 ID 和提供的 Cookie 去请求接口详情。

## 客户端示例代码

### 一次性获取所有接口信息

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["interface-server.js"],
});

const client = new Client({
  name: "interface-client",
  version: "1.0.0",
});

await client.connect(transport);

// 一次性获取所有接口信息
const allInfo = await client.callTool({
  name: "getAllInterfaceInfo",
  arguments: {
    apiUrl: "https://weapons.xxx/xxx",
    cookie: "your-cookie-value",
  },
});

const interfaceData = JSON.parse(allInfo.content[0].text);
console.log(interfaceData);

// 可以直接使用已格式化的信息
console.log(interfaceData.basicInfo.title);
console.log(interfaceData.formattedInfo.paramsMarkdown);
console.log(interfaceData.formattedInfo.responseStructureFormatted);
```

### 单独获取接口的各个部分信息

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["interface-server.js"],
});

const client = new Client({
  name: "interface-client",
  version: "1.0.0",
});

await client.connect(transport);

// 获取接口标题信息
const titleResult = await client.callTool({
  name: "getInterfaceTitle",
  arguments: {
    apiUrl: "https://weapons.xxx/xxx",
    cookie: "your-cookie-value",
  },
});

console.log(titleResult.content[0].text);

// 获取接口完整信息
const result = await client.callTool({
  name: "getInterfaceInfo",
  arguments: {
    apiUrl: "https://weapons.xxx/xxx",
    cookie: "your-cookie-value",
  },
});

console.log(result.content[0].text);
```

## 注意事项

- 确保提供的 Cookie 是有效的，否则接口请求会失败
- 如果 URL 格式不正确，服务器将返回错误
- 该工具适用于从 weapons.ke.com 获取接口信息
- 推荐使用 `getAllInterfaceInfo` 工具，可以一次性获取所有需要的信息

## 许可证

ISC
