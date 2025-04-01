# 错误捕获 MCP 服务器

这是一个基于 Model Context Protocol (MCP) 的 JavaScript 错误捕获和分析服务器。它可以捕获页面上的 JavaScript 错误，并提供修复建议。

## 功能特点

- 捕获 JavaScript 运行时错误
- 捕获未处理的 Promise 拒绝
- 捕获 console.error 调用
- 分析错误并提供修复建议
- 提供 Chrome 扩展进行可视化管理
- 支持 MCP 服务器与客户端通信

## 项目结构

```
DevToolsMcp/
├── index.js                  # MCP服务器主文件
├── package.json              # 项目依赖配置
├── error-catcher-client.js   # 浏览器客户端脚本
├── mcp-client.js             # MCP客户端
├── chrome-extension/         # Chrome扩展
│   ├── manifest.json         # 扩展配置
│   ├── content.js            # 内容脚本
│   ├── background.js         # 后台脚本
│   ├── popup.html            # 弹出页面
│   └── popup.js              # 弹出页面脚本
└── README.md                 # 项目说明
```

## 安装和使用

### 服务器端

1. 安装依赖：

```bash
cd DevToolsMcp
npm install
```

2. 启动服务器：

```bash
npm start
```

服务器默认在 http://localhost:3000 上运行。

### 客户端集成

有多种方式可以将错误捕获功能集成到您的网页：

#### 方法 1：使用提供的客户端脚本

```html
<script src="http://localhost:3000/client.js"></script>
```

#### 方法 2：使用提供的可配置客户端

```html
<script src="error-catcher-client.js"></script>
<script>
  window.ErrorCatcherMCP.init({
    serverUrl: "http://localhost:3000",
    captureGlobalErrors: true,
    capturePromiseRejections: true,
    captureConsoleErrors: true,
  });
</script>
```

#### 方法 3：使用 Chrome 扩展

1. 在 Chrome 浏览器中打开 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `DevToolsMcp/chrome-extension` 目录

扩展将自动捕获页面上的 JavaScript 错误并显示通知。

### MCP 客户端使用

如果您想通过 MCP 客户端 API 与服务器通信：

```javascript
import { ErrorCatcherClient } from "./mcp-client.js";

const client = new ErrorCatcherClient({
  serverUrl: "http://localhost:3000",
});

await client.connect();

// 获取错误列表
const errors = await client.getErrors();

// 分析特定错误
const analysis = await client.analyzeError(errorId);
console.log(analysis.content[0].text);

// 报告新错误
await client.reportError({
  message: "发生了一个错误",
  stack: "Error: 发生了一个错误\n    at myFunction (app.js:10)",
  url: "https://example.com/app.js",
  line: 10,
  column: 15,
});
```

## API 接口

### REST API

- `GET /api/errors` - 获取所有错误
- `POST /api/errors` - 报告新错误
- `DELETE /api/errors` - 清除所有错误
- `GET /api/errors/:id/analyze` - 分析特定错误

### MCP 资源

- `errors://list` - 获取所有错误列表
- `error://{id}` - 获取特定错误详情

### MCP 工具

- `report-error` - 报告新错误
- `analyze-error` - 分析错误并提供修复建议
- `clear-errors` - 清除所有错误

## 定制化

您可以通过修改 `index.js` 中的 `analyzeError` 工具函数来定制错误分析逻辑。例如，您可以集成更高级的代码分析工具或 AI 服务来提供更准确的修复建议。
