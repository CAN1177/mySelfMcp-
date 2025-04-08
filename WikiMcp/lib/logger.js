// logger.js - 日志功能模块
import fs from "fs";
import path from "path";

/**
 * 日志记录函数 - 写入可访问的日志文件
 * @param {string} message - 要记录的消息
 */
export function logToFile(message) {
  try {
    // 获取模块路径
    const currentFilePath = new URL(import.meta.url).pathname;
    // 获取WikiMcp目录
    const wikiMcpDir = path.dirname(path.dirname(currentFilePath));
    // 在WikiMcp目录下创建logs文件夹
    const logsDir = path.join(wikiMcpDir, "logs");

    // 确保logs目录存在
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // 创建带有日期的日志文件名
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}`;
    const logPath = path.join(logsDir, `wikimcp-${dateStr}.log`);

    // 添加时间戳和详细格式
    const timestamp = now.toISOString();
    const formattedMessage = `[${timestamp}] ${message}\n`;

    // 写入日志
    fs.appendFileSync(logPath, formattedMessage);

    // 同时写入到系统临时目录，作为备份
    const backupLogPath = "/tmp/wikimcp-log.txt";
    fs.appendFileSync(backupLogPath, formattedMessage);
  } catch (error) {
    // 如果日志写入失败，尝试写入系统临时目录
    try {
      const backupLogPath = "/tmp/wikimcp-error.txt";
      fs.appendFileSync(
        backupLogPath,
        `${new Date().toISOString()}: 日志记录失败: ${
          error.message
        }\n原始消息: ${message}\n`
      );
    } catch (e) {
      // 无法记录日志，但我们不能抛出错误，因为这可能导致应用程序崩溃
      console.error("无法写入日志: ", e.message);
    }
  }
}
