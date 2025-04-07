// wikiContentHandler.js - Wiki内容获取和处理模块
import axios from "axios";
import { z } from "zod";
import { updateImagePathsInMarkdown } from "./markdownConverter.js";

// 定义获取Wiki内容的schema
const wikiContentSchema = {
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
    .describe("完整的Cookie字符串，用于需要Cookie认证的Wiki系统（如链家Wiki）"),
  expand: z
    .string()
    .optional()
    .default("body.storage,space,version")
    .describe("要扩展的内容字段"),
  downloadImages: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否下载文档中的图片"),
};

/**
 * 获取Wiki内容的主处理函数
 * @param {Object} params - 参数对象
 * @param {Object} utils - 工具函数对象 {parseUrl, extractHtml, downloadImages, turndownService, extractImages, logToFile}
 * @returns {Object} - 处理结果
 */
async function handleGetWikiContent(params, utils) {
  const {
    parseUrl,
    extractHtml,
    downloadImages,
    turndownService,
    extractImages,
    logToFile,
  } = utils;

  const {
    url,
    baseUrl: initialBaseUrl,
    spaceKey: initialSpaceKey,
    contentId: initialContentId,
    username,
    password,
    token,
    cookie,
    expand,
    downloadImages: shouldDownloadImages = true,
  } = params;

  // 从params中单独提取title，并使用let声明以便后续修改
  let title = params.title;

  try {
    let urlToFetch = "";
    let isDirectFetch = false;
    let baseUrl = initialBaseUrl;
    let spaceKey = initialSpaceKey;
    let contentId = initialContentId;

    // 如果提供了URL，则解析URL获取参数
    if (url) {
      const parsedParams = parseUrl(url);
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
      }
    }

    // 处理认证信息
    let authUsername = username;
    let authPassword = password;

    // 如果是链家wiki，优先使用Cookie或Token
    if (isDirectFetch) {
      // 身份验证优先级：Cookie > Token > 环境变量
      if (cookie) {
        // 使用Cookie认证
        logToFile("使用提供的Cookie进行链家Wiki认证");
        authUsername = "cookie";
        authPassword = cookie;
      }
      // 其次使用传入的token
      else if (token) {
        logToFile("使用提供的token进行链家Wiki认证");
        authUsername = "token";
        authPassword = token;
      }
      // 再次使用环境变量中的cookie
      else if (process.env.LIANJIA_COOKIE) {
        logToFile("使用环境变量中的LIANJIA_COOKIE进行认证");
        authUsername = "cookie";
        authPassword = process.env.LIANJIA_COOKIE;
      }
      // 最后使用环境变量中的token
      else if (process.env.LIANJIA_TOKEN) {
        logToFile("使用环境变量中的LIANJIA_TOKEN进行认证");
        authUsername = "token";
        authPassword = process.env.LIANJIA_TOKEN;
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
    } else {
      // 非链家wiki，使用常规认证方式
      authUsername = authUsername || process.env.CONFLUENCE_USERNAME;
      authPassword = authPassword || process.env.CONFLUENCE_PASSWORD;
    }

    // 验证必要的参数
    if (!isDirectFetch && !baseUrl) {
      throw new Error("缺少baseUrl参数，需要提供Confluence服务器的基本URL");
    }

    if (!isDirectFetch && (!authUsername || !authPassword)) {
      throw new Error(
        "缺少认证信息，请提供username和password参数或在环境变量中配置，或者对于链家Wiki，提供token或cookie参数"
      );
    }

    // 创建认证头（基本认证、token认证或cookie认证）
    let headers = {};
    let authConfig = {};

    if (authUsername === "token") {
      // 使用token认证
      headers = {
        Authorization: `Bearer ${authPassword}`,
        // 添加模拟浏览器的请求头
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      };
    } else if (authUsername === "cookie") {
      // 使用cookie认证
      headers = {
        Cookie: authPassword,
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
        username: authUsername,
        password: authPassword,
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
        authUsername === "cookie"
          ? "Cookie"
          : authUsername === "token"
          ? "Token"
          : "Basic"
      }`
    );

    // 调用API或直接获取页面
    const response = await axios.get(apiUrl, {
      auth:
        authUsername === "token" || authUsername === "cookie"
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
    let imageMap = new Map();
    let imageFolderPath = null;
    let imageInfo = { total: 0, inTables: 0 };

    // 处理响应内容
    if (isDirectFetch) {
      // 直接获取的页面，使用JSDOM解析HTML内容
      if (typeof response.data === "string") {
        try {
          // 使用JSDOM提取内容
          logToFile(`收到HTML响应，大小: ${response.data.length} 字节`);
          const extractedContent = extractHtml(response.data);
          logToFile(`提取的内容大小: ${extractedContent.content.length} 字节`);

          // 提取页面中所有图片信息（包括表格中的图片）
          const extractedImages = extractImages(extractedContent.content);
          logToFile(
            `发现 ${extractedImages.length} 个图片，其中 ${
              extractedImages.filter((img) => img.inTable).length
            } 个在表格中`
          );
          imageInfo.total = extractedImages.length;
          imageInfo.inTables = extractedImages.filter(
            (img) => img.inTable
          ).length;

          // 下载页面中的图片（如果开启了该选项）
          if (shouldDownloadImages) {
            const pageId =
              contentId ||
              new URL(apiUrl).searchParams.get("pageId") ||
              Date.now().toString();
            const imageDownloadResult = await downloadImages(
              extractedContent,
              baseUrl || new URL(apiUrl).origin,
              headers,
              pageId
            );

            imageMap = imageDownloadResult.imageMap;
            imageFolderPath = imageDownloadResult.imageFolderPath;

            logToFile(
              `下载了 ${imageMap.size} 张图片到文件夹 ${imageFolderPath}`
            );
          }

          // 转换为Markdown
          markdownContent = `# ${extractedContent.title || "页面内容"}\n\n`;
          const convertedContent = turndownService.turndown(
            extractedContent.content
          );
          logToFile(`转换后的Markdown大小: ${convertedContent.length} 字节`);

          // 将原始Markdown内容添加到markdownContent
          markdownContent += convertedContent;

          // 如果有下载的图片，更新图片路径
          if (imageMap.size > 0) {
            markdownContent = updateImagePathsInMarkdown(
              markdownContent,
              imageMap
            );

            // 添加图片下载信息
            markdownContent += `\n\n---\n\n> 注意：文档中的 ${imageMap.size} 张图片（其中${imageInfo.inTables}张在表格中）已下载到本地文件夹 ${imageFolderPath}，并在Markdown中使用相对路径引用。`;
          }

          // 日志记录转换的内容长度，以便调试
          const lines = markdownContent.split("\n").length;
          logToFile(`生成的Markdown有 ${lines} 行`);
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
          // 提取HTML内容并处理图片下载
          const htmlContent = result.body.storage.value;
          let extractedContent = null;

          // 解析HTML以便下载图片
          if (shouldDownloadImages) {
            // 将API返回的HTML内容包装成完整的HTML文档
            const fullHtml = `<!DOCTYPE html><html><head><title>${
              result.title || "Wiki Document"
            }</title></head><body>${htmlContent}</body></html>`;
            extractedContent = extractHtml(fullHtml);

            // 提取页面中所有图片信息（包括表格中的图片）
            const extractedImages = extractImages(htmlContent);
            logToFile(
              `发现 ${extractedImages.length} 个图片，其中 ${
                extractedImages.filter((img) => img.inTable).length
              } 个在表格中`
            );
            imageInfo.total = extractedImages.length;
            imageInfo.inTables = extractedImages.filter(
              (img) => img.inTable
            ).length;

            // 下载图片
            const imageDownloadResult = await downloadImages(
              extractedContent,
              baseUrl,
              headers,
              contentId
            );

            imageMap = imageDownloadResult.imageMap;
            imageFolderPath = imageDownloadResult.imageFolderPath;

            logToFile(
              `下载了 ${imageMap.size} 张图片到文件夹 ${imageFolderPath}`
            );
          }

          // 将HTML内容转换为Markdown
          markdownContent = `# ${result.title || "文档"}\n\n`;
          markdownContent += turndownService.turndown(htmlContent);

          // 如果有下载的图片，更新图片路径
          if (imageMap.size > 0) {
            markdownContent = updateImagePathsInMarkdown(
              markdownContent,
              imageMap
            );

            // 添加图片下载信息
            markdownContent += `\n\n---\n\n> 注意：文档中的 ${imageMap.size} 张图片（其中${imageInfo.inTables}张在表格中）已下载到本地文件夹 ${imageFolderPath}，并在Markdown中使用相对路径引用。`;
          }
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
      imageFolderPath: imageFolderPath, // 返回图片文件夹路径，便于其他功能使用
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

// 导出模块
export const getWikiContentHandler = {
  schema: wikiContentSchema,
  handler: handleGetWikiContent,
};
