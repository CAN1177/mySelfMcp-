// WikiMcp - Confluence Wiki MCP服务器
// 该服务器允许通过MCP协议获取Confluence wiki内容并转换为Markdown格式

import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import TurndownService from "turndown";
import dotenv from "dotenv";
import fs from "fs";
import readline from "readline";

// 加载环境变量
dotenv.config();

// 创建HTML到Markdown的转换器
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// 日志记录函数 - 写入临时文件而不是控制台输出
function logToFile(message) {
  const logPath = "/tmp/wikimcp-log.txt";
  fs.appendFileSync(logPath, new Date().toISOString() + ": " + message + "\n");
}

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

/**
 * 解析Confluence Wiki链接
 * 支持以下格式:
 * - http://yourcompany.com/confluence/display/SPACEKEY/Page+Title
 * - http://yourcompany.com/confluence/pages/viewpage.action?pageId=123456
 * - http://yourcompany.com/confluence/spaces/SPACEKEY/pages/123456/Page+Title
 * @param {string} url - Confluence页面URL
 * @returns {Object} - 解析后的参数对象 {baseUrl, spaceKey, contentId, title}
 */
function parseConfluenceUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const result = {
      baseUrl: "",
      spaceKey: "",
      contentId: "",
      title: "",
    };

    // 提取基本URL (协议 + 主机 + 可能的上下文路径)
    const pathParts = parsedUrl.pathname.split("/");

    // 确定Confluence上下文路径
    let contextPath = "/";
    const confluencePathMarkers = ["display", "spaces", "pages", "browse"];

    for (let i = 1; i < pathParts.length; i++) {
      if (confluencePathMarkers.includes(pathParts[i])) {
        contextPath = "/" + pathParts.slice(1, i).join("/");
        break;
      }
    }

    // 构建baseUrl
    result.baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${contextPath}`;

    // 解析不同格式的URL
    if (parsedUrl.pathname.includes("/display/")) {
      // 格式: /display/SPACEKEY/Page+Title
      const displayIndex = parsedUrl.pathname.indexOf("/display/");
      const parts = parsedUrl.pathname.slice(displayIndex + 9).split("/");

      if (parts.length >= 1) {
        result.spaceKey = parts[0];
      }

      if (parts.length >= 2) {
        result.title = decodeURIComponent(
          parts.slice(1).join("/").replace(/\+/g, " ")
        );
      }
    } else if (parsedUrl.pathname.includes("/spaces/")) {
      // 格式: /spaces/SPACEKEY/pages/123456/Page+Title
      const spacesIndex = parsedUrl.pathname.indexOf("/spaces/");
      const parts = parsedUrl.pathname.slice(spacesIndex + 8).split("/");

      if (parts.length >= 1) {
        result.spaceKey = parts[0];
      }

      if (parts.length >= 3 && parts[1] === "pages") {
        result.contentId = parts[2];
      }

      if (parts.length >= 4) {
        result.title = decodeURIComponent(
          parts.slice(3).join("/").replace(/\+/g, " ")
        );
      }
    } else if (parsedUrl.pathname.includes("/pages/viewpage.action")) {
      // 格式: /pages/viewpage.action?pageId=123456
      result.contentId = parsedUrl.searchParams.get("pageId") || "";

      // 对于viewpage.action链接，我们无法直接获取spaceKey，需要后续通过API获取
    } else if (parsedUrl.pathname.includes("/pages/view.action")) {
      // 格式: /pages/view.action?pageId=123456
      result.contentId = parsedUrl.searchParams.get("pageId") || "";
    }

    return result;
  } catch (error) {
    console.error("解析Wiki链接失败:", error);
    return {
      baseUrl: "",
      spaceKey: "",
      contentId: "",
      title: "",
    };
  }
}

// 定义获取Wiki内容的工具
server.tool(
  "getWikiContent",
  {
    url: z
      .string()
      .describe(
        "Confluence Wiki页面的完整URL，例如：http://公司服务器地址:端口/confluence/pages/viewpage.action?pageId=123456"
      ),
    baseUrl: z
      .string()
      .optional()
      .describe("Confluence服务器的基本URL（可选，如果提供了URL则会自动解析）"),
    spaceKey: z
      .string()
      .optional()
      .describe(
        "Wiki空间的键值，例如：DEV, HR等（可选，如果提供了URL则会自动解析）"
      ),
    title: z.string().optional().describe("文档的标题（可选）"),
    contentId: z
      .string()
      .optional()
      .describe("文档的ID（可选，如果提供了URL则会自动解析）"),
    username: z
      .string()
      .optional()
      .describe("Confluence用户名（可选，如果不提供则使用环境变量中的用户名）"),
    password: z
      .string()
      .optional()
      .describe(
        "Confluence密码或API令牌（可选，如果不提供则使用环境变量中的密码）"
      ),
    token: z
      .string()
      .optional()
      .describe("特定Wiki系统的访问Token（如链家Wiki需要Token认证）"),
    cookie: z
      .string()
      .optional()
      .describe(
        "完整的Cookie字符串，用于需要Cookie认证的Wiki系统（如链家Wiki）"
      ),
    expand: z
      .string()
      .optional()
      .default("body.storage,space,version")
      .describe("要扩展的内容字段"),
  },
  async ({
    url,
    baseUrl,
    spaceKey,
    title,
    contentId,
    username,
    password,
    token,
    cookie,
    expand,
  }) => {
    try {
      let urlToFetch = "";
      let isDirectFetch = false;

      // 如果提供了URL，则解析URL获取参数
      if (url) {
        const parsedParams = parseConfluenceUrl(url);
        baseUrl = parsedParams.baseUrl || baseUrl;
        spaceKey = parsedParams.spaceKey || spaceKey;
        contentId = parsedParams.contentId || contentId;
        title = parsedParams.title || title;

        // 特定域名的特殊处理
        if (url.includes("wiki.lianjia.com")) {
          // 对于链家wiki，尝试直接获取页面内容而不是使用API
          isDirectFetch = true;
          urlToFetch = url;
          logToFile(`检测到链家wiki域名，将直接获取页面 ${url}`);

          // 身份验证优先级：Cookie > Token > 环境变量
          if (cookie) {
            // 使用Cookie认证
            logToFile("使用提供的Cookie进行链家Wiki认证");
            // 设置认证方式为cookie，后面会用
            username = "cookie";
            password = cookie;
          }
          // 其次使用传入的token
          else if (token) {
            logToFile("使用提供的token进行链家Wiki认证");
            username = "token";
            password = token;
          }
          // 再次使用环境变量中的cookie
          else if (process.env.LIANJIA_COOKIE) {
            logToFile("使用环境变量中的LIANJIA_COOKIE进行认证");
            username = "cookie";
            password = process.env.LIANJIA_COOKIE;
          }
          // 最后使用环境变量中的token
          else if (process.env.LIANJIA_TOKEN) {
            logToFile("使用环境变量中的LIANJIA_TOKEN进行认证");
            username = "token";
            password = process.env.LIANJIA_TOKEN;
          }
          // 如果没有提供任何认证信息，返回交互式指南而不是错误
          else {
            return {
              content: [
                {
                  type: "text",
                  text: `# 需要认证信息才能访问链家Wiki页面\n\n要访问这个Wiki，我们需要提供身份验证信息，可以是以下几种方式之一：\n\n## 1. 用户名和密码\n\n在下次调用时添加以下参数：\n\`\`\`json\n{\n  "url": "${url}",\n  "username": "您的链家wiki用户名",\n  "password": "您的链家wiki密码"\n}\n\`\`\`\n\n## 2. 认证令牌(token)\n\n在下次调用时添加以下参数：\n\`\`\`json\n{\n  "url": "${url}",\n  "token": "您的链家wiki访问token"\n}\n\`\`\`\n\n## 3. Cookie信息\n\n这是最推荐的方式，因为可以直接使用您在浏览器中的登录状态：\n\n1. 使用浏览器登录链家Wiki\n2. 打开开发者工具（F12或右键→检查）\n3. 切换到Network(网络)标签页\n4. 刷新页面，点击任意请求\n5. 找到Headers(标头)中的Cookie字段\n6. 复制完整的Cookie值\n\n然后在下次调用时添加以下参数：\n\`\`\`json\n{\n  "url": "${url}",\n  "cookie": "您复制的完整Cookie字符串"\n}\n\`\`\`\n\n请提供上述任一认证方式，我将帮您获取并分析这个Wiki页面的内容。`,
                },
              ],
            };
          }
        }
      }

      // 如果没有提供用户名和密码，则使用环境变量中的值(对于非直接获取模式)
      if (!isDirectFetch) {
        username = username || process.env.CONFLUENCE_USERNAME;
        password = password || process.env.CONFLUENCE_PASSWORD;
      }

      // 验证必要的参数
      if (!isDirectFetch && !baseUrl) {
        throw new Error("缺少baseUrl参数，需要提供Confluence服务器的基本URL");
      }

      if (!isDirectFetch && (!username || !password)) {
        throw new Error(
          "缺少认证信息，请提供username和password参数或在环境变量中配置，或者对于链家Wiki，提供token或cookie参数"
        );
      }

      // 创建认证头（基本认证、token认证或cookie认证）
      let headers = {};
      let authConfig = {};

      if (username === "token") {
        // 使用token认证
        headers = {
          Authorization: `Bearer ${password}`,
          // 添加模拟浏览器的请求头
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        };
      } else if (username === "cookie") {
        // 使用cookie认证
        headers = {
          Cookie: password,
          // 添加更多模拟浏览器的请求头
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        };

        // 添加referer头
        if (isDirectFetch && urlToFetch) {
          headers["Referer"] = new URL(urlToFetch).origin;
        } else if (baseUrl) {
          headers["Referer"] = baseUrl;
        }
      } else {
        // 使用基本认证
        authConfig = {
          username,
          password,
        };
      }

      // 根据是否直接获取页面来决定请求URL
      let apiUrl, params;

      if (isDirectFetch) {
        apiUrl = urlToFetch;
        params = {};
        logToFile(`将直接获取页面: ${apiUrl}`);
      } else {
        // 使用Confluence API
        apiUrl = `${baseUrl}/rest/api/content`;
        params = {
          expand,
        };

        // 添加spaceKey参数（如果有）
        if (spaceKey) {
          params.spaceKey = spaceKey;
        }

        // 如果提供了标题，则按标题筛选
        if (title) {
          params.title = title;
        }

        // 如果提供了内容ID，则直接获取该内容
        if (contentId) {
          apiUrl = `${apiUrl}/${contentId}`;
          params = { expand };
        }
      }

      // 记录请求详情，便于调试
      logToFile(`请求URL: ${apiUrl}`);
      logToFile(`请求参数: ${JSON.stringify(params)}`);
      logToFile(
        `认证方式: ${
          username === "cookie"
            ? "Cookie"
            : username === "token"
            ? "Token"
            : "Basic"
        }`
      );

      // 调用API或直接获取页面
      const response = await axios.get(apiUrl, {
        auth:
          username === "token" || username === "cookie"
            ? undefined
            : authConfig,
        headers,
        params,
        // 添加超时设置
        timeout: 15000,
        // 允许跟随重定向
        maxRedirects: 5,
        validateStatus: function (status) {
          // 接受所有状态码，以便我们可以处理错误
          return true;
        },
      });

      // 记录响应状态
      logToFile(`响应状态码: ${response.status}`);

      // 处理错误状态码
      if (response.status >= 400) {
        let errorMessage = "";

        if (response.status === 404) {
          errorMessage = `# 无法获取Wiki内容 (404错误)\n\n服务器返回了404错误。这表示请求的页面不存在或您没有访问权限。可能的原因有：\n\n1. 页面ID可能不正确或页面已被删除\n2. Cookie/Token可能已过期或无效\n3. 您可能没有访问该页面的权限\n4. Wiki系统可能发生了变化\n\n## 请尝试以下步骤：\n\n1. 检查页面ID是否正确\n2. 更新Cookie信息（从浏览器中获取最新的Cookie）\n3. 确认您有权限访问该页面\n4. 通过Wiki界面直接访问该页面，确认其是否存在\n\n如果您能通过浏览器直接访问，但这里无法获取，请尝试：\n\n1. 使用更完整的Cookie信息\n2. 确认Cookie中包含了所有必要的验证信息\n\n具体错误: ${
            response.data && typeof response.data === "string"
              ? response.data.substring(0, 500)
              : "未提供详细错误信息"
          }`;
        } else {
          errorMessage = `# 获取Wiki内容时出错: HTTP ${
            response.status
          }\n\n服务器返回了错误状态码。详细信息：\n\n${
            response.data && typeof response.data === "string"
              ? response.data.substring(0, 500)
              : JSON.stringify(response.data, null, 2).substring(0, 500)
          }`;
        }

        return {
          content: [{ type: "text", text: errorMessage }],
          isError: true,
        };
      }

      let markdownContent = "";

      // 处理响应内容
      if (isDirectFetch) {
        // 直接获取的页面，需要解析HTML内容
        if (typeof response.data === "string") {
          try {
            // 从HTML中提取主要内容
            // 假设主要内容在id为"main-content"的div内
            const mainContentMatch = response.data.match(
              /<div[^>]*id="main-content"[^>]*>([\s\S]*?)<\/div>/i
            );
            const pageTitle = response.data.match(
              /<title[^>]*>([\s\S]*?)<\/title>/i
            );

            let htmlContent = "";
            if (mainContentMatch && mainContentMatch[1]) {
              htmlContent = mainContentMatch[1];
            } else {
              // 如果找不到主要内容区，使用整个body内容
              const bodyMatch = response.data.match(
                /<body[^>]*>([\s\S]*?)<\/body>/i
              );
              if (bodyMatch && bodyMatch[1]) {
                htmlContent = bodyMatch[1];
              } else {
                htmlContent = response.data;
              }
            }

            // 转换为Markdown
            markdownContent = `# ${
              pageTitle && pageTitle[1] ? pageTitle[1].trim() : "页面内容"
            }\n\n`;
            markdownContent += turndownService.turndown(htmlContent);
          } catch (parseError) {
            logToFile(`解析HTML内容时出错: ${parseError.message}`);
            markdownContent = `# 获取到页面，但解析内容时出错\n\n错误详情: ${parseError.message}\n\n页面大小: ${response.data.length} 字节`;
          }
        } else {
          markdownContent = `# 获取到非文本响应\n\n服务器返回了非文本内容，无法解析为Markdown。`;
        }
      } else {
        // Confluence API响应处理
        if (contentId) {
          // 单个文档响应格式
          const result = response.data;
          if (result.body && result.body.storage && result.body.storage.value) {
            // 将HTML内容转换为Markdown
            markdownContent = `# ${result.title || "文档"}\n\n`;
            markdownContent += turndownService.turndown(
              result.body.storage.value
            );
          } else {
            // 当没有正确的内容格式时
            logToFile(
              `接收到的数据结构不符合预期: ${JSON.stringify(result).substring(
                0,
                200
              )}...`
            );
            markdownContent = `# ${
              result.title || "获取的文档"
            }\n\n*无法解析文档内容，可能格式不兼容或响应结构发生变化*\n\n原始响应数据：\n\`\`\`json\n${JSON.stringify(
              result,
              null,
              2
            ).substring(0, 1000)}...\n\`\`\``;
          }
        } else {
          // 文档列表响应格式
          const result = response.data;
          if (result.results && result.results.length > 0) {
            // 格式化结果列表
            markdownContent = `# 找到 ${result.results.length} 个文档\n\n`;

            for (const item of result.results) {
              markdownContent += `## ${item.title}\n`;
              markdownContent += `- ID: ${item.id}\n`;
              markdownContent += `- 空间: ${
                item.space?.name || spaceKey || "未知空间"
              }\n`;
              markdownContent += `- 链接: ${baseUrl}/pages/viewpage.action?pageId=${item.id}\n\n`;

              if (item.body && item.body.storage && item.body.storage.value) {
                markdownContent +=
                  turndownService.turndown(item.body.storage.value) + "\n\n";
              }
            }
          } else {
            markdownContent = "未找到匹配的文档";
          }
        }
      }

      return {
        content: [
          {
            type: "text",
            text: markdownContent,
          },
        ],
      };
    } catch (error) {
      logToFile(`获取Wiki内容时发生错误: ${error.stack || error.message}`);
      console.error("获取Wiki内容时出错:", error.message);
      return {
        content: [
          {
            type: "text",
            text: `# 获取Wiki内容时出错\n\n发生了一个错误: ${error.message}\n\n请检查您的连接和认证信息是否正确。如果您使用的是Cookie认证，请确保Cookie是完整且有效的。`,
          },
        ],
        isError: true,
      };
    }
  }
);

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
        // 单个文档响应
        const result = response.data;
        markdownContent = `# ${result.title}\n\n`;

        if (result.body && result.body.storage && result.body.storage.value) {
          markdownContent += turndownService.turndown(
            result.body.storage.value
          );
        }
      } else {
        // 文档列表响应
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
              code { background: #f4f5f7; padding: 2px 5px; border-radius: 3px; }
            </style>
          </head>
          <body>
            <h1>WikiMcp 服务器</h1>
            <p>这是一个MCP服务器，可以通过MCP协议获取Confluence Wiki内容并转换为Markdown格式。</p>
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
