// 引入必要的库和依赖
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";

// 创建MCP服务器
const server = new McpServer({
  name: "GetInterfaceInfo",
  version: "1.0.0",
  description: "获取接口信息的MCP服务",
});

// 获取接口信息的工具
server.tool(
  "getInterfaceInfo",
  {
    apiUrl: z
      .string()
      .describe("接口文档地址，格式如：https://weapons.xxx/xxx"),
    cookie: z.string().describe("认证Cookie"),
  },
  async ({ apiUrl, cookie }) => {
    try {
      // 从URL中解析出接口ID
      const urlPattern = /\/interface\/api\/(\d+)/;
      const match = apiUrl.match(urlPattern);

      if (!match || !match[1]) {
        return {
          content: [
            {
              type: "text",
              text: "无法从URL中解析出接口ID，请确保URL格式正确",
            },
          ],
          isError: true,
        };
      }

      const interfaceId = match[1];

      // 构建请求URL和请求头
      const requestUrl = `https://weapons.ke.com/api/open/interface/detail?id=${interfaceId}`;
      const headers = {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
        Referer: apiUrl,
      };

      // 发送请求获取接口详情
      const response = await axios.get(requestUrl, { headers });

      if (response.data.errcode !== 0) {
        return {
          content: [
            {
              type: "text",
              text: `获取接口信息失败: ${response.data.errmsg || "未知错误"}`,
            },
          ],
          isError: true,
        };
      }

      // 提取需要的信息
      const data = response.data.data;

      // 提取我们需要的四个部分
      const interfaceInfo = {
        path: data.path,
        method: data.method,
        req_query: data.req_query || [],
        res_body: data.res_body ? JSON.parse(data.res_body) : {},
      };

      // 返回结果
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(interfaceInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      // 处理错误情况
      return {
        content: [
          {
            type: "text",
            text: `获取接口信息失败: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// 返回格式化接口参数的工具
server.tool(
  "formatInterfaceParams",
  {
    apiUrl: z
      .string()
      .describe("接口文档地址，格式如：https://weapons.xxx/xxx"),
    cookie: z.string().describe("认证Cookie"),
  },
  async ({ apiUrl, cookie }) => {
    try {
      // 从URL中解析出接口ID
      const urlPattern = /\/interface\/api\/(\d+)/;
      const match = apiUrl.match(urlPattern);

      if (!match || !match[1]) {
        return {
          content: [
            {
              type: "text",
              text: "无法从URL中解析出接口ID，请确保URL格式正确",
            },
          ],
          isError: true,
        };
      }

      const interfaceId = match[1];

      // 构建请求URL和请求头
      const requestUrl = `https://weapons.ke.com/api/open/interface/detail?id=${interfaceId}`;
      const headers = {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
        Referer: apiUrl,
      };

      // 发送请求获取接口详情
      const response = await axios.get(requestUrl, { headers });

      if (response.data.errcode !== 0) {
        return {
          content: [
            {
              type: "text",
              text: `获取接口信息失败: ${response.data.errmsg || "未知错误"}`,
            },
          ],
          isError: true,
        };
      }

      const data = response.data.data;

      // 格式化请求参数
      let paramsDescription = "## 请求参数\n\n";
      if (data.req_query && data.req_query.length > 0) {
        paramsDescription += "| 参数名 | 描述 | 是否必须 | 类型 |\n";
        paramsDescription += "|-------|------|----------|------|\n";

        data.req_query.forEach((param) => {
          paramsDescription += `| ${param.name} | ${param.desc} | ${
            param.required ? "是" : "否"
          } | ${param.schema_type} |\n`;
        });
      } else {
        paramsDescription += "无请求参数\n";
      }

      return {
        content: [
          {
            type: "text",
            text: paramsDescription,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `格式化接口参数失败: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// 格式化返回结构的工具
server.tool(
  "formatResponseStructure",
  {
    apiUrl: z
      .string()
      .describe("接口文档地址，格式如：https://weapons.xxx/xxx"),
    cookie: z.string().describe("认证Cookie"),
  },
  async ({ apiUrl, cookie }) => {
    try {
      // 从URL中解析出接口ID
      const urlPattern = /\/interface\/api\/(\d+)/;
      const match = apiUrl.match(urlPattern);

      if (!match || !match[1]) {
        return {
          content: [
            {
              type: "text",
              text: "无法从URL中解析出接口ID，请确保URL格式正确",
            },
          ],
          isError: true,
        };
      }

      const interfaceId = match[1];

      // 构建请求URL和请求头
      const requestUrl = `https://weapons.ke.com/api/open/interface/detail?id=${interfaceId}`;
      const headers = {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
        Referer: apiUrl,
      };

      // 发送请求获取接口详情
      const response = await axios.get(requestUrl, { headers });

      if (response.data.errcode !== 0) {
        return {
          content: [
            {
              type: "text",
              text: `获取接口信息失败: ${response.data.errmsg || "未知错误"}`,
            },
          ],
          isError: true,
        };
      }

      const data = response.data.data;
      const resBody = data.res_body ? JSON.parse(data.res_body) : {};

      // 使用递归函数格式化JSON结构
      function formatJsonStructure(obj, indent = 0) {
        const spaces = " ".repeat(indent);
        let result = "";

        if (obj.properties) {
          Object.keys(obj.properties).forEach((key) => {
            const prop = obj.properties[key];
            let type = prop.type;
            if (type === "array" && prop.items) {
              type = `${type}<${prop.items.type || "object"}>`;
            }

            result += `${spaces}${key}: ${type} // ${
              prop.description || "无描述"
            }\n`;

            // 如果有嵌套属性，递归处理
            if (prop.properties) {
              result += `${spaces}{\n`;
              result += formatJsonStructure(prop, indent + 2);
              result += `${spaces}}\n`;
            } else if (
              type === "array" &&
              prop.items &&
              prop.items.properties
            ) {
              result += `${spaces}[\n`;
              result += `${spaces}  {\n`;
              result += formatJsonStructure(prop.items, indent + 4);
              result += `${spaces}  }\n`;
              result += `${spaces}]\n`;
            }
          });
        }

        return result;
      }

      const formattedStructure = formatJsonStructure(resBody);

      return {
        content: [
          {
            type: "text",
            text: `## 返回结构\n\n\`\`\`\n${formattedStructure}\`\`\``,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `格式化返回结构失败: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// 获取接口描述
server.tool(
  "getInterfaceTitle",
  {
    apiUrl: z
      .string()
      .describe("接口文档地址，格式如：https://weapons.xxx/xxx"),
    cookie: z.string().describe("认证Cookie"),
  },
  async ({ apiUrl, cookie }) => {
    try {
      // 从URL中解析出接口ID
      const urlPattern = /\/interface\/api\/(\d+)/;
      const match = apiUrl.match(urlPattern);

      if (!match || !match[1]) {
        return {
          content: [
            {
              type: "text",
              text: "无法从URL中解析出接口ID，请确保URL格式正确",
            },
          ],
          isError: true,
        };
      }

      const interfaceId = match[1];

      // 构建请求URL和请求头
      const requestUrl = `https://weapons.ke.com/api/open/interface/detail?id=${interfaceId}`;
      const headers = {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
        Referer: apiUrl,
      };

      // 发送请求获取接口详情
      const response = await axios.get(requestUrl, { headers });

      if (response.data.errcode !== 0) {
        return {
          content: [
            {
              type: "text",
              text: `获取接口信息失败: ${response.data.errmsg || "未知错误"}`,
            },
          ],
          isError: true,
        };
      }

      // 提取接口标题信息
      const data = response.data.data;
      const title = data.title || "无标题";
      const path = data.path || "";
      const method = data.method || "";

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                title,
                path,
                method,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      // 处理错误情况
      return {
        content: [
          {
            type: "text",
            text: `获取接口描述失败: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// 一次获取所有接口信息
server.tool(
  "getAllInterfaceInfo",
  {
    apiUrl: z
      .string()
      .describe("接口文档地址，格式如：https://weapons.xxx/xxx"),
    cookie: z.string().describe("认证Cookie"),
  },
  async ({ apiUrl, cookie }) => {
    try {
      // 从URL中解析出接口ID
      const urlPattern = /\/interface\/api\/(\d+)/;
      const match = apiUrl.match(urlPattern);

      if (!match || !match[1]) {
        return {
          content: [
            {
              type: "text",
              text: "无法从URL中解析出接口ID，请确保URL格式正确",
            },
          ],
          isError: true,
        };
      }

      const interfaceId = match[1];

      // 构建请求URL和请求头
      const requestUrl = `https://weapons.ke.com/api/open/interface/detail?id=${interfaceId}`;
      const headers = {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
        Referer: apiUrl,
      };

      // 发送请求获取接口详情
      const response = await axios.get(requestUrl, { headers });

      if (response.data.errcode !== 0) {
        return {
          content: [
            {
              type: "text",
              text: `获取接口信息失败: ${response.data.errmsg || "未知错误"}`,
            },
          ],
          isError: true,
        };
      }

      // 提取接口信息
      const data = response.data.data;
      const title = data.title || "无标题";
      const path = data.path || "";
      const method = data.method || "";
      const req_query = data.req_query || [];
      const resBody = data.res_body ? JSON.parse(data.res_body) : {};

      // 格式化请求参数
      let paramsDescription = "## 请求参数\n\n";
      if (req_query && req_query.length > 0) {
        paramsDescription += "| 参数名 | 描述 | 是否必须 | 类型 |\n";
        paramsDescription += "|-------|------|----------|------|\n";

        req_query.forEach((param) => {
          paramsDescription += `| ${param.name} | ${param.desc} | ${
            param.required ? "是" : "否"
          } | ${param.schema_type} |\n`;
        });
      } else {
        paramsDescription += "无请求参数\n";
      }

      // 格式化返回结构
      function formatJsonStructure(obj, indent = 0) {
        const spaces = " ".repeat(indent);
        let result = "";

        if (obj.properties) {
          Object.keys(obj.properties).forEach((key) => {
            const prop = obj.properties[key];
            let type = prop.type;
            if (type === "array" && prop.items) {
              type = `${type}<${prop.items.type || "object"}>`;
            }

            result += `${spaces}${key}: ${type} // ${
              prop.description || "无描述"
            }\n`;

            // 如果有嵌套属性，递归处理
            if (prop.properties) {
              result += `${spaces}{\n`;
              result += formatJsonStructure(prop, indent + 2);
              result += `${spaces}}\n`;
            } else if (
              type === "array" &&
              prop.items &&
              prop.items.properties
            ) {
              result += `${spaces}[\n`;
              result += `${spaces}  {\n`;
              result += formatJsonStructure(prop.items, indent + 4);
              result += `${spaces}  }\n`;
              result += `${spaces}]\n`;
            }
          });
        }

        return result;
      }

      const formattedStructure = formatJsonStructure(resBody);

      // 合并所有信息
      const allInfo = {
        basicInfo: {
          title,
          path,
          method,
        },
        requestParams: req_query,
        responseStructure: resBody,
        formattedInfo: {
          paramsMarkdown: paramsDescription,
          responseStructureFormatted: `## 返回结构\n\n\`\`\`\n${formattedStructure}\`\`\``,
        },
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(allInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      // 处理错误情况
      return {
        content: [
          {
            type: "text",
            text: `获取接口信息失败: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// 启动服务器
async function startServer() {
  try {
    // 创建标准IO传输
    const transport = new StdioServerTransport();

    // 连接服务器
    await server.connect(transport);

    console.log("接口信息MCP服务器已启动");
  } catch (error) {
    console.error("服务器启动失败:", error);
    process.exit(1);
  }
}

// 启动服务器
startServer();
