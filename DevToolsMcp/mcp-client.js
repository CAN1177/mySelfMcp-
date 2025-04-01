import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

/**
 * MCP错误捕获客户端
 * 用于与MCP错误捕获服务器通信并获取错误分析
 */
export class ErrorCatcherClient {
  constructor(options = {}) {
    this.options = {
      serverUrl: "http://localhost:3000",
      ...options,
    };

    this.client = null;
    this.connected = false;
  }

  /**
   * 连接到MCP服务器
   */
  async connect() {
    try {
      const transport = new SSEClientTransport({
        sseUrl: `${this.options.serverUrl}/sse`,
        postUrl: `${this.options.serverUrl}/messages`,
      });

      this.client = new Client(
        {
          name: "error-catcher-client",
          version: "1.0.0",
        },
        {
          capabilities: {
            resources: {},
            tools: {},
          },
        }
      );

      await this.client.connect(transport);
      this.connected = true;

      console.log("已连接到MCP错误捕获服务器");
      return true;
    } catch (err) {
      console.error("连接MCP服务器失败:", err);
      this.connected = false;
      return false;
    }
  }

  /**
   * 获取错误列表
   */
  async getErrors() {
    if (!this.ensureConnected()) return [];

    try {
      const resource = await this.client.readResource("errors://list");
      return JSON.parse(resource.contents[0].text);
    } catch (err) {
      console.error("获取错误列表失败:", err);
      return [];
    }
  }

  /**
   * 获取指定ID的错误
   */
  async getError(id) {
    if (!this.ensureConnected()) return null;

    try {
      const resource = await this.client.readResource(`error://${id}`);
      return JSON.parse(resource.contents[0].text);
    } catch (err) {
      console.error(`获取错误(ID: ${id})失败:`, err);
      return null;
    }
  }

  /**
   * 报告新错误
   */
  async reportError(errorData) {
    if (!this.ensureConnected()) return null;

    try {
      const result = await this.client.callTool({
        name: "report-error",
        arguments: errorData,
      });

      return result;
    } catch (err) {
      console.error("报告错误失败:", err);
      return null;
    }
  }

  /**
   * 分析错误并获取修复建议
   */
  async analyzeError(errorId) {
    if (!this.ensureConnected()) return null;

    try {
      const result = await this.client.callTool({
        name: "analyze-error",
        arguments: { errorId },
      });

      return result;
    } catch (err) {
      console.error("分析错误失败:", err);
      return null;
    }
  }

  /**
   * 清除所有错误
   */
  async clearErrors() {
    if (!this.ensureConnected()) return false;

    try {
      const result = await this.client.callTool({
        name: "clear-errors",
        arguments: {},
      });

      return true;
    } catch (err) {
      console.error("清除错误失败:", err);
      return false;
    }
  }

  /**
   * 确保已连接到服务器
   */
  ensureConnected() {
    if (!this.connected) {
      console.error("未连接到MCP服务器");
      return false;
    }
    return true;
  }

  /**
   * 断开与MCP服务器的连接
   */
  async disconnect() {
    if (this.client && this.connected) {
      await this.client.disconnect();
      this.connected = false;
      console.log("已断开与MCP服务器的连接");
    }
  }
}

// 使用示例
// const errorClient = new ErrorCatcherClient();
// await errorClient.connect();
// const errors = await errorClient.getErrors();
// const analysis = await errorClient.analyzeError(1);
// console.log(analysis.content[0].text);
