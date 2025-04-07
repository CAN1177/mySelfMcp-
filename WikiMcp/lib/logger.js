// logger.js - 日志功能模块
import fs from "fs";

/**
 * 日志记录函数 - 写入临时文件而不是控制台输出
 * @param {string} message - 要记录的消息
 */
export function logToFile(message) {
  const logPath = "/tmp/wikimcp-log.txt";
  fs.appendFileSync(logPath, new Date().toISOString() + ": " + message + "\n");
}
