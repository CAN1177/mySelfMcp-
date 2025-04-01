import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 创建MCP服务器
const server = new McpServer({
  name: "Error-Catcher-MCP",
  version: "1.0.0",
  description: "捕获页面控制台错误并提供修复建议",
});

// 创建一个存储错误的内存存储
const errorStore = {
  errors: [],
  addError(error) {
    this.errors.push({
      ...error,
      timestamp: new Date().toISOString(),
      id: this.errors.length + 1,
    });
    return this.errors[this.errors.length - 1];
  },
  getErrors() {
    return this.errors;
  },
  getErrorById(id) {
    return this.errors.find((e) => e.id === id);
  },
  clearErrors() {
    this.errors = [];
    return { success: true };
  },
};

// 定义资源 - 获取错误列表
server.resource("errors", "errors://list", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      text: JSON.stringify(errorStore.getErrors(), null, 2),
    },
  ],
}));

// 定义资源 - 获取特定错误
server.resource("error", "error://{id}", async (uri, { id }) => {
  const errorId = parseInt(id, 10);
  const error = errorStore.getErrorById(errorId);

  if (!error) {
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify({ error: "未找到错误" }, null, 2),
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(error, null, 2),
      },
    ],
  };
});

// 定义工具 - 报告新错误
server.tool(
  "report-error",
  {
    message: z.string(),
    stack: z.string().optional(),
    url: z.string().optional(),
    line: z.number().optional(),
    column: z.number().optional(),
    source: z.string().optional(),
    context: z.string().optional(),
  },
  async (params) => {
    const error = errorStore.addError(params);
    return {
      content: [
        {
          type: "text",
          text: `错误已记录，ID: ${error.id}`,
        },
      ],
    };
  }
);

// 定义工具 - 分析错误并提供修复建议
server.tool(
  "analyze-error",
  {
    errorId: z.number(),
  },
  async ({ errorId }) => {
    const error = errorStore.getErrorById(errorId);
    if (!error) {
      return {
        content: [
          {
            type: "text",
            text: "未找到该错误",
          },
        ],
        isError: true,
      };
    }

    // 在这里你可以实现更复杂的错误分析逻辑
    // 这里只是一个简单的示例
    let analysis = "错误分析：\n";
    analysis += `错误消息: ${error.message}\n`;

    if (error.stack) {
      analysis += `堆栈追踪: ${error.stack}\n`;
    }

    if (error.source) {
      analysis += `源代码: ${error.source}\n`;
    }

    // 生成建议（这里应该有更智能的逻辑）
    let suggestions = "修复建议：\n";

    // 根据常见错误模式提供建议
    if (error.message.includes("is not defined")) {
      const varName = error.message.split(" is not defined")[0].trim();
      suggestions += `- 错误看起来是变量 '${varName}' 未定义。确保在使用前声明该变量，或者检查拼写是否正确。\n`;
    } else if (error.message.includes("is not a function")) {
      const funcName = error.message.split(" is not a function")[0].trim();
      suggestions += `- 尝试将 '${funcName}' 作为函数调用，但它不是一个函数。检查该变量的类型和值。\n`;
    } else if (error.message.includes("Cannot read property")) {
      suggestions +=
        "- 尝试访问undefined或null对象的属性。使用可选链操作符 (?.) 或在访问属性前检查对象是否存在。\n";
    } else {
      suggestions +=
        "- 检查相关代码逻辑\n- 确保所有变量在使用前已声明\n- 查看是否有类型错误\n";
    }

    return {
      content: [
        {
          type: "text",
          text: analysis + "\n" + suggestions,
        },
      ],
    };
  }
);

// 定义工具 - 清除所有错误
server.tool("clear-errors", {}, async () => {
  const result = errorStore.clearErrors();
  return {
    content: [
      {
        type: "text",
        text: `所有错误已清除`,
      },
    ],
  };
});

// 定义提示模板 - 用于错误报告
server.prompt(
  "report-error-template",
  {
    errorInfo: z.string(),
  },
  ({ errorInfo }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `我的页面出现了以下错误，请帮我分析并提供修复建议：\n\n${errorInfo}`,
        },
      },
    ],
  })
);

// 检测是否为命令行模式（Cursor MCP集成）
const isCliMode = process.stdin.isTTY === undefined;

if (isCliMode) {
  // Cursor MCP集成模式 - 使用stdio传输
  console.error("启动错误捕获MCP服务器（stdio模式）");

  // 使用stdio传输
  const stdioTransport = new StdioServerTransport();

  // 连接服务器
  server.connect(stdioTransport).catch((error) => {
    console.error("MCP服务器连接失败:", error);
    process.exit(1);
  });
} else {
  // Web服务器模式
  // 创建Express应用
  const app = express();
  app.use(cors());
  app.use(express.json());

  // 设置SSE传输层
  const transports = {};

  // SSE端点
  app.get("/sse", async (_, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;

    res.on("close", () => {
      delete transports[transport.sessionId];
    });

    await server.connect(transport);
  });

  // 消息处理端点
  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = transports[sessionId];

    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send("未找到对应的传输会话");
    }
  });

  // REST API端点 - 用于直接报告错误
  app.post("/api/errors", (req, res) => {
    const error = errorStore.addError(req.body);
    res.json({ success: true, errorId: error.id });
  });

  // REST API端点 - 获取所有错误
  app.get("/api/errors", (_, res) => {
    res.json(errorStore.getErrors());
  });

  // REST API端点 - 分析特定错误
  app.get("/api/errors/:id/analyze", async (req, res) => {
    const errorId = parseInt(req.params.id, 10);
    const error = errorStore.getErrorById(errorId);

    if (!error) {
      return res.status(404).json({ error: "未找到错误" });
    }

    // 简单分析逻辑
    let suggestions = "";

    if (error.message.includes("is not defined")) {
      const varName = error.message.split(" is not defined")[0].trim();
      suggestions = `变量 '${varName}' 未定义。确保在使用前声明该变量，或者检查拼写是否正确。`;
    } else if (error.message.includes("is not a function")) {
      const funcName = error.message.split(" is not a function")[0].trim();
      suggestions = `'${funcName}' 不是一个函数。检查该变量的类型和值。`;
    } else if (error.message.includes("Cannot read property")) {
      suggestions =
        "尝试访问undefined或null对象的属性。使用可选链操作符 (?.) 或在访问属性前检查对象是否存在。";
    } else {
      suggestions =
        "检查相关代码逻辑，确保所有变量在使用前已声明，查看是否有类型错误。";
    }

    res.json({
      error: error,
      suggestions: suggestions,
    });
  });

  // 删除错误的API端点
  app.delete("/api/errors", (_, res) => {
    errorStore.clearErrors();
    res.json({ success: true });
  });

  // 前端客户端JavaScript
  app.get("/client.js", (_, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.send(`
      // 错误捕获客户端
      (function() {
        const SERVER_URL = window.location.protocol + '//' + window.location.host;
        
        // 捕获全局未处理错误
        window.addEventListener('error', function(event) {
          const errorData = {
            message: event.message || 'Unknown error',
            stack: event.error?.stack || '',
            url: event.filename || window.location.href,
            line: event.lineno,
            column: event.colno,
            source: '',
            context: document.title || window.location.pathname
          };
          
          reportError(errorData);
        });
        
        // 捕获Promise未处理的rejection
        window.addEventListener('unhandledrejection', function(event) {
          const errorData = {
            message: event.reason?.message || 'Unhandled Promise rejection',
            stack: event.reason?.stack || '',
            url: window.location.href,
            context: document.title || window.location.pathname
          };
          
          reportError(errorData);
        });
        
        // 重写console.error方法
        const originalConsoleError = console.error;
        console.error = function() {
          // 调用原始方法
          originalConsoleError.apply(console, arguments);
          
          // 报告错误
          const errorMessage = Array.from(arguments).map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' ');
          
          reportError({
            message: errorMessage,
            url: window.location.href,
            context: 'console.error',
          });
        };
        
        // 发送错误到服务器
        function reportError(errorData) {
          fetch(SERVER_URL + '/api/errors', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(errorData),
          })
          .catch(err => {
            // 避免递归错误
            originalConsoleError('Error reporting error:', err);
          });
        }
        
        console.log('错误捕获客户端已初始化');
      })();
    `);
  });

  // 简单的演示HTML页面
  app.get("/", (_, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>错误捕获演示</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          button { margin: 5px; padding: 8px 16px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
          .errors { margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>错误捕获演示</h1>
        <p>点击下面的按钮生成不同类型的错误：</p>
        
        <div>
          <button onclick="generateReferenceError()">引用错误</button>
          <button onclick="generateTypeError()">类型错误</button>
          <button onclick="generateSyntaxError()">语法错误</button>
          <button onclick="generatePromiseRejection()">Promise拒绝</button>
          <button onclick="logConsoleError()">Console.error</button>
        </div>
        
        <div>
          <button onclick="loadErrors()">加载错误列表</button>
          <button onclick="clearErrors()">清除所有错误</button>
        </div>
        
        <div class="errors">
          <h2>错误列表</h2>
          <pre id="errorsList">无错误</pre>
        </div>
        
        <script src="/client.js"></script>
        <script>
          function generateReferenceError() {
            try {
              // 故意引用不存在的变量
              console.log(undefinedVariable);
            } catch (e) {
              console.error("引用错误:", e.message);
            }
          }
          
          function generateTypeError() {
            try {
              // 尝试将非函数作为函数调用
              const obj = {};
              obj.notAFunction();
            } catch (e) {
              console.error("类型错误:", e.message);
            }
          }
          
          function generateSyntaxError() {
            try {
              // 故意创建语法错误
              eval("if (true) {");
            } catch (e) {
              console.error("语法错误:", e.message);
            }
          }
          
          function generatePromiseRejection() {
            // 未处理的Promise拒绝
            new Promise((resolve, reject) => {
              reject(new Error("示例Promise拒绝"));
            });
          }
          
          function logConsoleError() {
            console.error("这是一个console.error消息", { detail: "一些额外信息" });
          }
          
          function loadErrors() {
            fetch('/api/errors')
              .then(response => response.json())
              .then(data => {
                document.getElementById('errorsList').textContent = JSON.stringify(data, null, 2);
              })
              .catch(err => {
                console.error("加载错误失败:", err);
              });
          }
          
          function clearErrors() {
            fetch('/api/errors', { method: 'DELETE' })
              .then(() => loadErrors())
              .catch(err => {
                console.error("清除错误失败:", err);
              });
          }
        </script>
      </body>
      </html>
    `);
  });

  // 启动服务器
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`错误捕获MCP服务器已在端口 ${PORT} 上启动`);
  });
}
