import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import express from "express";
import fs from "fs";

// 中文常见编程词汇到英文的映射
const commonMappings = {
  // 数据类型
  字符串: "string",
  数字: "number",
  整数: "integer",
  浮点数: "float",
  布尔: "boolean",
  数组: "array",
  对象: "object",
  空: "null",
  未定义: "undefined",

  // 常见变量名
  用户: "user",
  名称: "name",
  标题: "title",
  描述: "description",
  列表: "list",
  索引: "index",
  计数: "count",
  值: "value",
  项目: "item",
  配置: "config",
  设置: "settings",
  选项: "options",
  数据: "data",
  结果: "result",
  状态: "status",
  错误: "error",
  警告: "warning",
  成功: "success",
  消息: "message",

  // 常见函数动词
  获取: "get",
  设置: "set",
  创建: "create",
  删除: "delete",
  更新: "update",
  添加: "add",
  移除: "remove",
  查找: "find",
  搜索: "search",
  过滤: "filter",
  排序: "sort",
};

// 将中文短语转换为驼峰命名法
function translateToCamelCase(phrase) {
  const segments = phrase.split(/[\s,.，。、；;：:\s]+/).filter(Boolean);
  return segments
    .map((segment, index) => {
      const translated = commonMappings[segment] || segment;
      if (index === 0) {
        return translated.toLowerCase();
      }
      return (
        translated.charAt(0).toUpperCase() + translated.slice(1).toLowerCase()
      );
    })
    .join("");
}

// 将中文短语转换为帕斯卡命名法
function translateToPascalCase(phrase) {
  const segments = phrase.split(/[\s,.，。、；;：:\s]+/).filter(Boolean);
  return segments
    .map((segment) => {
      const translated = commonMappings[segment] || segment;
      return (
        translated.charAt(0).toUpperCase() + translated.slice(1).toLowerCase()
      );
    })
    .join("");
}

// 将中文短语转换为下划线命名法
function translateToSnakeCase(phrase) {
  const segments = phrase.split(/[\s,.，。、；;：:\s]+/).filter(Boolean);
  return segments
    .map((segment) => {
      const translated = commonMappings[segment] || segment;
      return translated.toLowerCase();
    })
    .join("_");
}

// 将中文短语转换为烤串命名法
function translateToKebabCase(phrase) {
  const segments = phrase.split(/[\s,.，。、；;：:\s]+/).filter(Boolean);
  return segments
    .map((segment) => {
      const translated = commonMappings[segment] || segment;
      return translated.toLowerCase();
    })
    .join("-");
}

// 创建服务器
const server = new McpServer({
  name: "transemantix",
  version: "1.0.0",
  description: "汉语翻译为符合语义化的英文命名工具",
});

// 定义翻译工具
server.tool(
  "translate",
  {
    input: z.string().describe("需要翻译的中文短语"),
    style: z
      .enum(["camelCase", "PascalCase", "snake_case", "kebab-case"])
      .default("camelCase")
      .describe("命名风格"),
  },
  async ({ input, style }) => {
    let result;

    try {
      switch (style) {
        case "camelCase":
          result = translateToCamelCase(input);
          break;
        case "PascalCase":
          result = translateToPascalCase(input);
          break;
        case "snake_case":
          result = translateToSnakeCase(input);
          break;
        case "kebab-case":
          result = translateToKebabCase(input);
          break;
        default:
          result = translateToCamelCase(input);
      }

      return {
        content: [{ type: "text", text: result }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `翻译失败: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// 定义批量翻译工具
server.tool(
  "batch-translate",
  {
    inputs: z.array(z.string()).describe("需要翻译的中文短语列表"),
    style: z
      .enum(["camelCase", "PascalCase", "snake_case", "kebab-case"])
      .default("camelCase")
      .describe("命名风格"),
  },
  async ({ inputs, style }) => {
    try {
      const results = inputs.map((input) => {
        let translated;

        switch (style) {
          case "camelCase":
            translated = translateToCamelCase(input);
            break;
          case "PascalCase":
            translated = translateToPascalCase(input);
            break;
          case "snake_case":
            translated = translateToSnakeCase(input);
            break;
          case "kebab-case":
            translated = translateToKebabCase(input);
            break;
          default:
            translated = translateToCamelCase(input);
        }

        return { original: input, translated };
      });

      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `批量翻译失败: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// 日志记录函数 - 写入临时文件而不是控制台输出
function logToFile(message) {
  const logPath = "/tmp/transemantix-log.txt";
  fs.appendFileSync(logPath, new Date().toISOString() + ": " + message + "\n");
}

// 捕获全局错误
process.on("uncaughtException", (error) => {
  logToFile(`未捕获的异常: ${error.stack || error.message || error}`);
});

// 启动服务器函数
async function startServer() {
  try {
    const serverType = process.env.SERVER_TYPE || "stdio";

    if (serverType === "http") {
      // HTTP/SSE 模式
      const app = express();
      app.use(express.json());

      const transports = {};

      app.get("/sse", (req, res) => {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;

        res.on("close", () => {
          delete transports[transport.sessionId];
        });

        server.connect(transport).catch((err) => {
          logToFile(`SSE 连接错误: ${err.message}`);
        });
      });

      app.post("/messages", async (req, res) => {
        const sessionId = req.query.sessionId;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send("无效的会话 ID");
          return;
        }

        try {
          await transports[sessionId].handlePostMessage(req, res);
        } catch (error) {
          logToFile(`消息处理错误: ${error.message}`);
          res.status(500).send("服务器错误");
        }
      });

      const port = 3008;
      app.listen(port);
      logToFile(`HTTP 服务器已启动，端口: ${port}`);
    } else {
      // 标准输入输出模式
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logToFile("标准输入输出服务器已启动");
    }
  } catch (error) {
    logToFile(`服务器启动错误: ${error.stack || error.message || error}`);
    process.exit(1);
  }
}

// 启动服务器
startServer();
