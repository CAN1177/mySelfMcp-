// WikiMcp - Confluence Wiki MCP服务器
// 该服务器允许通过MCP协议获取Confluence wiki内容并转换为Markdown格式

import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import dotenv from "dotenv";
import readline from "readline";

// 引入抽离的模块
import { parseConfluenceUrl } from "./lib/urlParser.js";
import { extractContentFromHtml } from "./lib/htmlParser.js";
import {
  setupTurndownService,
  updateImagePathsInMarkdown,
  extractImagesFromHtml,
} from "./lib/markdownConverter.js";
import { logToFile } from "./lib/logger.js";
import { downloadImagesFromHtml } from "./lib/imageDownloader.js";
import { getWikiContentHandler } from "./lib/wikiContentHandler.js";

// 加载环境变量
dotenv.config();

// 创建HTML到Markdown的转换器
const turndownService = setupTurndownService();

// 创建MCP服务器
const server = new McpServer({
  name: "WikiMcp",
  version: "1.0.0",
  description: "通过MCP协议获取Confluence wiki内容并转换为Markdown格式",
});

// 捕获全局错误
process.on("uncaughtException", (error) => {
  logToFile(`未捕获的异常: ${error.stack || error.message || error}`);
});

// 创建Express应用
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3331;

// 存储会话信息的对象
const transports = {};

// 询问链家wiki token的函数
async function askForLianjiaAuth() {
  // 如果处于stdio模式，不能使用标准输入（会干扰MCP通信）
  // 所以如果是在stdio模式下，直接返回
  if (process.env.SERVER_TYPE !== "http") {
    return;
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("链家Wiki认证设置:");
    console.log("1. 您可以设置Cookie或Token来访问链家Wiki");
    console.log("2. 在调用getWikiContent时也可以直接提供cookie或token参数");

    rl.question(
      "请选择认证方式 [1:Cookie, 2:Token, 直接回车跳过]: ",
      (choice) => {
        if (choice === "1") {
          rl.question(
            "请输入链家Wiki的Cookie (完整的Cookie字符串): ",
            (cookie) => {
              if (cookie.trim()) {
                process.env.LIANJIA_COOKIE = cookie.trim();
                console.log("已设置链家Wiki Cookie");
                logToFile("用户设置了链家Wiki Cookie");
              }
              rl.close();
              resolve();
            }
          );
        } else if (choice === "2") {
          rl.question("请输入链家Wiki的访问Token: ", (token) => {
            if (token.trim()) {
              process.env.LIANJIA_TOKEN = token.trim();
              console.log("已设置链家Wiki Token");
              logToFile("用户设置了链家Wiki Token");
            }
            rl.close();
            resolve();
          });
        } else {
          rl.close();
          resolve();
        }
      }
    );
  });
}

// 定义获取Wiki内容的工具，使用抽离的处理器函数
server.tool("getWikiContent", getWikiContentHandler.schema, async (params) => {
  return await getWikiContentHandler.handler(params, {
    parseUrl: parseConfluenceUrl,
    extractHtml: extractContentFromHtml,
    downloadImages: downloadImagesFromHtml,
    turndownService: turndownService,
    extractImages: extractImagesFromHtml,
    logToFile: logToFile,
  });
});

// 定义资源接口，通过URI获取文档
server.resource(
  "wiki",
  "wiki://{baseUrl}/{spaceKey}/{contentId?}",
  async (uri, { baseUrl, spaceKey, contentId }) => {
    try {
      // 需要在调用时提供认证信息
      // 这里我们简化处理，假设认证信息作为查询参数传递或使用环境变量
      const url = new URL(uri.href);
      const username =
        url.searchParams.get("username") || process.env.CONFLUENCE_USERNAME;
      const password =
        url.searchParams.get("password") || process.env.CONFLUENCE_PASSWORD;

      if (!username || !password) {
        throw new Error(
          "缺少认证信息，请提供username和password查询参数或在环境变量中配置"
        );
      }

      let apiUrl = `${baseUrl}/rest/api/content`;
      let params = {
        spaceKey,
        expand: "body.storage,space,version",
      };

      if (contentId && contentId !== "list") {
        apiUrl = `${apiUrl}/${contentId}`;
        params = { expand: "body.storage,space,version" };
      }

      // 调用Confluence API
      const response = await axios.get(apiUrl, {
        auth: { username, password },
        params,
      });

      let markdownContent = "";

      if (contentId && contentId !== "list") {
        // 单个文档响应格式
        const result = response.data;
        markdownContent = `# ${result.title}\n\n`;

        if (result.body && result.body.storage && result.body.storage.value) {
          // 提取HTML内容
          const htmlContent = result.body.storage.value;

          // 将API返回的HTML内容包装成完整的HTML文档以便处理图片
          const fullHtml = `<!DOCTYPE html><html><head><title>${
            result.title || "Wiki Document"
          }</title></head><body>${htmlContent}</body></html>`;
          const extractedContent = extractContentFromHtml(fullHtml);

          // 下载图片
          const imageDownloadResult = await downloadImagesFromHtml(
            extractedContent,
            baseUrl,
            {
              Authorization: `Basic ${Buffer.from(
                `${username}:${password}`
              ).toString("base64")}`,
            },
            contentId
          );

          // 转换为Markdown
          const convertedContent = turndownService.turndown(htmlContent);
          markdownContent += convertedContent;

          // 如果有下载的图片，更新图片路径
          if (imageDownloadResult.imageMap.size > 0) {
            markdownContent = updateImagePathsInMarkdown(
              markdownContent,
              imageDownloadResult.imageMap
            );

            // 添加图片下载信息
            markdownContent += `\n\n---\n\n> 注意：文档中的 ${imageDownloadResult.imageMap.size} 张图片已下载到本地文件夹 ${imageDownloadResult.imageFolderPath}，并在Markdown中使用相对路径引用。`;
          }
        }
      } else {
        // 文档列表响应格式
        const result = response.data;
        markdownContent = `# ${spaceKey} 空间的文档列表\n\n`;

        if (result.results && result.results.length > 0) {
          for (const item of result.results) {
            markdownContent += `## ${item.title}\n`;
            markdownContent += `- ID: ${item.id}\n`;
            markdownContent += `- 链接: ${baseUrl}/pages/viewpage.action?pageId=${item.id}\n\n`;
          }
        } else {
          markdownContent += "未找到文档";
        }
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: markdownContent,
          },
        ],
      };
    } catch (error) {
      console.error("资源获取失败:", error.message);
      return {
        contents: [
          {
            uri: uri.href,
            text: `获取Wiki资源时出错: ${error.message}`,
          },
        ],
      };
    }
  }
);

// 启动服务器函数
async function startServer() {
  try {
    console.log("WikiMcp 服务器启动中...");
    console.log("增强版本: 支持表格中图片、改进的表格解析");

    const serverType = process.env.SERVER_TYPE || "stdio";

    // 如果是HTTP模式，询问链家wiki token
    if (serverType === "http") {
      await askForLianjiaAuth();
    }

    if (serverType === "http") {
      // HTTP/SSE 模式
      // 设置SSE端点
      app.get("/sse", async (req, res) => {
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

      // 设置消息端点
      app.post("/messages", async (req, res) => {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];

        if (transport) {
          await transport.handlePostMessage(req, res);
        } else {
          res.status(400).send("无效的会话ID");
        }
      });

      // 添加一个简单的欢迎页面
      app.get("/", (req, res) => {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>WikiMcp - Confluence Wiki MCP服务器</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
              h1 { color: #0052CC; }
              h2 { color: #0747A6; margin-top: 30px; }
              code { background: #f4f5f7; padding: 2px 5px; border-radius: 3px; }
              pre { background: #f4f5f7; padding: 15px; border-radius: 5px; overflow-x: auto; }
              .feature { background: #E3FCEF; padding: 10px 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #36B37E; }
            </style>
          </head>
          <body>
            <h1>WikiMcp 服务器</h1>
            <p>这是一个MCP服务器，可以通过MCP协议获取Confluence Wiki内容并转换为Markdown格式。</p>
            
            <div class="feature">
              <h2>增强功能</h2>
              <ul>
                <li><strong>表格支持</strong>：正确解析和渲染复杂表格结构，包括嵌套表格和合并单元格</li>
                <li><strong>图片下载</strong>：自动下载Wiki文档中的所有图片(包括表格中的图片)，存储到桌面的WikiImages文件夹中</li>
                <li><strong>离线访问</strong>：生成的Markdown使用相对路径引用图片，方便离线浏览</li>
              </ul>
            </div>
            
            <h2>使用方法</h2>
            <p>通过MCP客户端连接到该服务器的SSE端点：<code>${
              req.protocol
            }://${req.get("host")}/sse</code></p>
            <p>然后，您可以使用以下工具访问Confluence内容：</p>
            <pre>getWikiContent({
  url: "http://公司服务器地址:端口/confluence/pages/viewpage.action?pageId=123456"
})</pre>
            <p>或者使用单独的参数：</p>
            <pre>getWikiContent({
  baseUrl: "http://公司服务器地址:端口/confluence",
  spaceKey: "DEV",
  title: "文档标题", // 可选
  contentId: "123456", // 可选，如果提供则直接获取指定ID的文档
})</pre>
            <p>认证信息将从环境变量中获取，或者您也可以在调用时提供：</p>
            <pre>getWikiContent({
  url: "http://公司服务器地址:端口/confluence/pages/viewpage.action?pageId=123456",
  username: "用户名", // 可选，如果环境变量中已配置
  password: "密码或API令牌" // 可选，如果环境变量中已配置
})</pre>
            <p><strong>链家Wiki专用参数</strong>：</p>
            <pre>getWikiContent({
  url: "https://wiki.lianjia.com/pages/viewpage.action?pageId=123456",
  cookie: "您的完整Cookie字符串" // 推荐
})</pre>
            
            <h2>图片和表格处理</h2>
            <p>WikiMcp会自动：</p>
            <ul>
              <li>识别Wiki文档中的所有图片，包括表格中的图片</li>
              <li>下载图片到桌面上的WikiImages/[文档名_哈希]文件夹</li>
              <li>特殊处理表格中的图片，确保在Markdown表格中正确显示</li>
              <li>修复表格结构，确保复杂表格在Markdown预览中正确渲染</li>
            </ul>
          </body>
          </html>
        `);
      });

      // 启动HTTP服务器
      app.listen(PORT, () => {
        console.log(`WikiMcp HTTP服务器运行在 http://localhost:${PORT}`);
        logToFile(`WikiMcp HTTP服务器已启动，端口: ${PORT}`);

        // 显示环境变量配置状态
        const usernameConfigured = !!process.env.CONFLUENCE_USERNAME;
        const passwordConfigured = !!process.env.CONFLUENCE_PASSWORD;

        console.log(`环境变量配置状态：`);
        console.log(
          `- CONFLUENCE_USERNAME: ${usernameConfigured ? "已配置" : "未配置"}`
        );
        console.log(
          `- CONFLUENCE_PASSWORD: ${passwordConfigured ? "已配置" : "未配置"}`
        );

        if (!usernameConfigured || !passwordConfigured) {
          console.log(`提示：您可以创建.env文件配置认证信息，参考.env.example`);
        }
      });
    } else {
      // 标准输入输出模式
      const transport = new StdioServerTransport();
      await server.connect(transport);
      // 不输出到控制台，因为会干扰通信
      logToFile("WikiMcp 标准输入输出服务器已启动");
    }
  } catch (error) {
    logToFile(`服务器启动错误: ${error.stack || error.message || error}`);
    process.exit(1);
  }
}

// 启动服务器
startServer();
