// MCP客户端示例代码
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// 创建客户端传输
const transport = new StdioClientTransport({
  command: "node",
  args: ["interface-server.js"],
});

// 创建MCP客户端
const client = new Client({
  name: "interface-client",
  version: "1.0.0",
});

// 连接到服务器
async function main() {
  try {
    console.log("正在连接到接口信息MCP服务器...");
    await client.connect(transport);
    console.log("成功连接到服务器");

    // 列出所有工具
    const tools = await client.listTools();
    console.log(
      "可用工具列表:",
      tools.tools.map((tool) => tool.name)
    );

    // 设置接口文档地址和cookie（需要修改为实际的值）
    const apiUrl = "https://weapons.ke.com/project/21680/interface/api/1815190";
    const cookie =
      "crosSdkDT2019DeviceId=-o4n4vw-mye2yu-bdwlmbm8bid5l9v-o83nmyefn; wx_device_id=u_LRfAnyF-p1UrLiuRI3DL7RiYV3IjKh_mXwsddR1zE=; lianjia_uuid=d6d151d3-1cc9-4a61-b12a-9e7696f4ce2c; lianjia_b_token=2.00158a95478006150204232bf5f51b2ba6; _yapi_uid=289793; sensorsdata2015jssdkcross=%7B%22distinct_id%22%3A%2218f9fc77a0b845-0671cf4ec5f886-1b525637-2073600-18f9fc77a0c248e%22%2C%22%24device_id%22%3A%2218f9fc77a0b845-0671cf4ec5f886-1b525637-2073600-18f9fc77a0c248e%22%2C%22props%22%3A%7B%22%24latest_traffic_source_type%22%3A%22%E7%9B%B4%E6%8E%A5%E6%B5%81%E9%87%8F%22%2C%22%24latest_referrer%22%3A%22%22%2C%22%24latest_search_keyword%22%3A%22%E6%9C%AA%E5%8F%96%E5%88%B0%E5%80%BC_%E7%9B%B4%E6%8E%A5%E6%89%93%E5%BC%80%22%2C%22%24latest_referrer_host%22%3A%22%22%7D%2C%22identities%22%3A%22eyIkaWRlbnRpdHlfY29va2llX2lkIjoiMThmOWZjNzdhMGI4NDUtMDY3MWNmNGVjNWY4ODYtMWI1MjU2MzctMjA3MzYwMC0xOGY5ZmM3N2EwYzI0OGUifQ%3D%3D%22%2C%22history_login_id%22%3A%7B%22";

    console.log("\n使用单个API获取全部接口信息...");
    const allInfo = await client.callTool({
      name: "getAllInterfaceInfo",
      arguments: {
        apiUrl,
        cookie,
      },
    });

    // 解析返回的JSON
    const interfaceData = JSON.parse(allInfo.content[0].text);

    // 显示接口基本信息
    console.log("\n基本信息:");
    console.log(`标题: ${interfaceData.basicInfo.title}`);
    console.log(`路径: ${interfaceData.basicInfo.path}`);
    console.log(`方法: ${interfaceData.basicInfo.method}`);

    // 显示请求参数
    console.log("\n请求参数:");
    console.log(interfaceData.formattedInfo.paramsMarkdown);

    // 显示返回结构
    console.log("\n返回结构:");
    console.log(interfaceData.formattedInfo.responseStructureFormatted);

    // 单独调用各个工具的示例（可选）
    console.log("\n=== 以下是单独调用各个工具的示例 ===");

    // 获取接口标题
    console.log("\n获取接口标题信息...");
    const titleInfo = await client.callTool({
      name: "getInterfaceTitle",
      arguments: {
        apiUrl,
        cookie,
      },
    });
    console.log("接口标题信息:", titleInfo.content[0].text);

    // 获取接口信息
    console.log("\n获取接口基本信息...");
    const interfaceInfo = await client.callTool({
      name: "getInterfaceInfo",
      arguments: {
        apiUrl,
        cookie,
      },
    });
    console.log("接口信息:", interfaceInfo.content[0].text);

    // 格式化接口参数
    console.log("\n格式化接口参数...");
    const formattedParams = await client.callTool({
      name: "formatInterfaceParams",
      arguments: {
        apiUrl,
        cookie,
      },
    });
    console.log(formattedParams.content[0].text);

    // 格式化返回结构
    console.log("\n格式化返回结构...");
    const responseStructure = await client.callTool({
      name: "formatResponseStructure",
      arguments: {
        apiUrl,
        cookie,
      },
    });
    console.log(responseStructure.content[0].text);
  } catch (error) {
    console.error("错误:", error);
  } finally {
    // 断开连接
    await transport.disconnect();
    console.log("已断开与服务器的连接");
  }
}

// 运行主函数
main();
