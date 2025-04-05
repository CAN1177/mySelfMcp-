// WikiMcp 客户端示例
// 演示如何连接到 WikiMcp 服务器并获取内容

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";

async function main() {
  // 创建客户端配置
  const client = new Client(
    {
      name: "WikiMcp-Client",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  try {
    // 连接到MCP服务器
    // 注意：调整为您的服务器地址
    const serverUrl = "http://localhost:3002";
    const transport = new HttpClientTransport({
      sseUrl: `${serverUrl}/sse`,
      postUrl: `${serverUrl}/messages`,
    });

    console.log("正在连接到WikiMcp服务器...");
    await client.connect(transport);
    console.log("连接成功！");

    // 获取工具列表
    const tools = await client.listTools();
    console.log(
      "可用工具:",
      tools.tools.map((t) => t.name)
    );

    // 使用getWikiContent工具获取Wiki内容
    if (tools.tools.some((t) => t.name === "getWikiContent")) {
      console.log("\n==== 测试通过URL直接获取Wiki内容 ====");

      // 示例1：通过完整URL获取内容（推荐方式）
      const result1 = await client.callTool({
        name: "getWikiContent",
        arguments: {
          url: "http://公司服务器地址:端口/confluence/pages/viewpage.action?pageId=123456",
          // 认证信息将从环境变量中获取，或者也可以在这里提供
          // username: "您的用户名",
          // password: "您的密码或API令牌"
        },
      });

      console.log("\n示例1 - 通过URL获取的内容（已转换为Markdown）:");
      if (result1.content && result1.content.length > 0) {
        console.log(result1.content[0].text);
      } else if (result1.isError) {
        console.error("获取内容时出错:", result1);
      }

      console.log("\n==== 测试通过单独参数获取Wiki内容 ====");

      // 示例2：通过单独参数获取内容
      const result2 = await client.callTool({
        name: "getWikiContent",
        arguments: {
          baseUrl: "http://公司服务器地址:端口/confluence",
          spaceKey: "示例空间",
          title: "示例文档", // 如果知道确切标题
          // contentId: "123456", // 或者使用文档ID
          // 认证信息将从环境变量中获取
        },
      });

      console.log("\n示例2 - 通过单独参数获取的内容:");
      if (result2.content && result2.content.length > 0) {
        console.log(result2.content[0].text);
      } else if (result2.isError) {
        console.error("获取内容时出错:", result2);
      }
    }

    // 获取资源列表
    const resources = await client.listResources();
    console.log(
      "\n可用资源:",
      resources.resources.map((r) => r.uriTemplate)
    );

    // 使用资源接口获取内容
    if (resources.resources.some((r) => r.name === "wiki")) {
      console.log("\n==== 测试获取Wiki资源 ====");

      // 注意：资源URI可以不传递认证信息，会使用环境变量中的认证信息
      const resourceUri =
        "wiki://http://公司服务器地址:端口/confluence/示例空间/123456";

      try {
        const resource = await client.readResource(resourceUri);
        console.log("\n获取的资源内容:");
        if (resource.contents && resource.contents.length > 0) {
          console.log(resource.contents[0].text);
        }
      } catch (err) {
        console.error("获取资源时出错:", err.message);
      }
    }
  } catch (error) {
    console.error("错误:", error);
  } finally {
    // 关闭客户端连接
    await client.close();
    console.log("连接已关闭");
  }
}

main();
