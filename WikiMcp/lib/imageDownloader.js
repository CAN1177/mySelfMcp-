// imageDownloader.js - 图片下载处理模块
import fs from "fs";
import path from "path";
import axios from "axios";
import crypto from "crypto";
import { logToFile } from "./logger.js";
import { extractImagesFromHtml } from "./markdownConverter.js";

/**
 * 从HTML内容中提取和下载图片
 * @param {Object} extractedContent - 从HTML中提取的内容对象 {dom, content, title}
 * @param {string} baseUrl - 基础URL，用于解析相对路径
 * @param {Object} headers - 请求头信息
 * @param {string} pageId - 页面ID，用于创建唯一文件夹
 * @returns {Object} - 下载结果 {imageMap, imageFolderPath}
 */
export async function downloadImagesFromHtml(
  extractedContent,
  baseUrl,
  headers,
  pageId
) {
  // 如果没有提供有效的DOM对象，则无法处理图片
  if (!extractedContent || !extractedContent.dom) {
    logToFile("无法处理图片：没有提供有效的DOM对象");
    return { imageMap: new Map(), imageFolderPath: null };
  }

  try {
    // 获取当前模块的绝对路径
    const currentFilePath = new URL(import.meta.url).pathname;
    // 获取WikiMcp目录的绝对路径
    const wikiMcpDir = path.dirname(path.dirname(currentFilePath));

    // 创建images目录的绝对路径
    const imageFolderPath = path.join(wikiMcpDir, "images");

    logToFile(`======图片下载信息======`);
    logToFile(`当前模块路径: ${currentFilePath}`);
    logToFile(`WikiMcp目录: ${wikiMcpDir}`);
    logToFile(`图片保存路径: ${imageFolderPath}`);

    // 如果images文件夹已存在，先清空它
    if (fs.existsSync(imageFolderPath)) {
      logToFile(`图片目录已存在，准备清空`);
      try {
        const files = fs.readdirSync(imageFolderPath);
        logToFile(`发现 ${files.length} 个文件需要清除`);
        for (const file of files) {
          if (file !== ".gitkeep" && file !== "test.txt") {
            // 保留某些文件
            const filePath = path.join(imageFolderPath, file);
            fs.unlinkSync(filePath);
            logToFile(`已删除文件: ${filePath}`);
          }
        }
        logToFile(`已清空图片文件夹: ${imageFolderPath}`);
      } catch (err) {
        logToFile(`清空图片文件夹时出错: ${err.message}`);
        logToFile(`错误堆栈: ${err.stack}`);
      }
    } else {
      // 创建images文件夹
      logToFile(`图片目录不存在，准备创建`);
      try {
        fs.mkdirSync(imageFolderPath, { recursive: true });
        logToFile(`创建图片文件夹成功: ${imageFolderPath}`);
      } catch (err) {
        logToFile(`创建图片文件夹时出错: ${err.message}`);
        logToFile(`错误堆栈: ${err.stack}`);

        // 尝试创建一个测试文件，检查写入权限
        try {
          const testFilePath = path.join(
            wikiMcpDir,
            "test_write_permission.txt"
          );
          fs.writeFileSync(testFilePath, "test");
          logToFile(`测试文件创建成功: ${testFilePath}`);
          fs.unlinkSync(testFilePath);
        } catch (testErr) {
          logToFile(`测试文件创建失败，可能是权限问题: ${testErr.message}`);
        }

        // 如果创建目录失败，尝试其他位置
        try {
          const altPath = path.join(process.cwd(), "images");
          logToFile(`尝试在当前工作目录创建images文件夹: ${altPath}`);
          fs.mkdirSync(altPath, { recursive: true });
          logToFile(`在当前工作目录创建images文件夹成功: ${altPath}`);
          return { imageMap: new Map(), imageFolderPath: altPath };
        } catch (altErr) {
          logToFile(`在当前工作目录创建images文件夹失败: ${altErr.message}`);
        }
      }
    }

    // 使用提取图片的功能获取所有图片信息
    const imageInfos = extractImagesFromHtml(extractedContent.dom);

    logToFile(`从DOM中找到 ${imageInfos.length} 张图片，其中包括表格内的图片`);

    // 存储图片URL到本地路径的映射
    const imageMap = new Map();

    // 下载所有图片
    const imagePromises = [];

    for (let i = 0; i < imageInfos.length; i++) {
      const imageInfo = imageInfos[i];
      const src = imageInfo.src;
      const inTable = imageInfo.inTable;

      if (!src || src.startsWith("data:")) {
        // 跳过空路径或base64编码的图片
        logToFile(
          `跳过图片 #${i}: ${
            src ? src.substring(0, 30) + "..." : "empty"
          } (data URI或空路径)`
        );
        continue;
      }

      logToFile(`准备下载图片 #${i}: ${src.substring(0, 50)}...`);

      imagePromises.push(
        downloadImage(src, imageFolderPath, i, baseUrl, headers, inTable)
          .then(({ success, originalUrl, localPath, inTable }) => {
            if (success) {
              // 固定使用./images/文件名作为相对路径
              const fileName = path.basename(localPath);
              const relativePath = `./images/${fileName}`;
              imageMap.set(originalUrl, relativePath);
              logToFile(
                `已下载图片 #${i}: ${originalUrl.substring(
                  0,
                  30
                )}... -> ${relativePath}${inTable ? " (表格中)" : ""}`
              );
            } else {
              logToFile(`图片 #${i} 下载失败: ${src.substring(0, 50)}...`);
            }
          })
          .catch((error) => {
            logToFile(
              `下载图片 #${i} 时出错 ${src.substring(0, 30)}...: ${
                error.message
              }`
            );
            logToFile(`错误堆栈: ${error.stack}`);
          })
      );
    }

    // 等待所有图片下载完成
    await Promise.all(imagePromises);

    logToFile(
      `图片下载完成，共下载 ${imageMap.size} 张图片到 ${imageFolderPath}`
    );
    logToFile(`======图片下载结束======`);

    return { imageMap, imageFolderPath };
  } catch (error) {
    logToFile(`处理图片时出错: ${error.message}`);
    logToFile(`错误堆栈: ${error.stack}`);
    return { imageMap: new Map(), imageFolderPath: null };
  }
}

/**
 * 下载单个图片
 * @param {string} url - 图片URL
 * @param {string} folderPath - 保存图片的文件夹路径
 * @param {number} index - 图片索引
 * @param {string} baseUrl - 基础URL，用于解析相对路径
 * @param {Object} headers - 请求头信息
 * @param {boolean} inTable - 图片是否在表格中
 * @returns {Promise<Object>} - 下载结果
 */
async function downloadImage(
  url,
  folderPath,
  index,
  baseUrl,
  headers,
  inTable = false
) {
  try {
    // 处理URL
    let fullUrl = url;
    if (!url.startsWith("http") && !url.startsWith("//")) {
      // 处理相对路径
      if (url.startsWith("/")) {
        // 以根路径开始的相对路径
        const baseUrlObj = new URL(baseUrl);
        fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${url}`;
      } else {
        // 相对当前路径的相对路径
        fullUrl = new URL(url, baseUrl).href;
      }
    } else if (url.startsWith("//")) {
      // 处理协议相对URL
      fullUrl = `https:${url}`;
    }

    logToFile(
      `下载图片 #${index}: 转换URL ${url} -> ${fullUrl}${
        inTable ? " (表格中)" : ""
      }`
    );

    // 获取图片
    try {
      logToFile(`发起请求: ${fullUrl.substring(0, 100)}...`);
      const response = await axios.get(fullUrl, {
        responseType: "arraybuffer",
        headers,
        timeout: 30000, // 增加超时时间到30秒
        maxRedirects: 5,
      });

      logToFile(
        `请求成功，状态码: ${response.status}, 数据大小: ${response.data.length} 字节`
      );

      // 确定文件扩展名
      const contentType = response.headers["content-type"];
      let extension = ".png"; // 默认扩展名

      if (contentType) {
        logToFile(`Content-Type: ${contentType}`);
        if (contentType.includes("jpeg") || contentType.includes("jpg")) {
          extension = ".jpg";
        } else if (contentType.includes("png")) {
          extension = ".png";
        } else if (contentType.includes("gif")) {
          extension = ".gif";
        } else if (contentType.includes("svg")) {
          extension = ".svg";
        } else if (contentType.includes("webp")) {
          extension = ".webp";
        }
      } else {
        // 从URL中尝试获取扩展名
        try {
          const urlExt = path.extname(new URL(fullUrl).pathname).toLowerCase();
          logToFile(`从URL路径提取的扩展名: ${urlExt}`);
          if (
            urlExt &&
            [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"].includes(urlExt)
          ) {
            extension = urlExt;
          }
        } catch (err) {
          logToFile(`从URL获取扩展名时出错: ${err.message}`);
        }
      }

      // 简化文件名，只使用索引号
      const tableIndicator = inTable ? "_table" : "";
      const fileName = `img_${index}${tableIndicator}${extension}`;
      const filePath = path.join(folderPath, fileName);

      logToFile(`准备写入文件: ${filePath}`);

      // 写入文件
      try {
        fs.writeFileSync(filePath, response.data);
        logToFile(
          `文件写入成功: ${filePath}, 大小: ${response.data.length} 字节`
        );

        // 验证文件是否成功写入
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          logToFile(`文件验证: ${filePath} 存在, 大小: ${stats.size} 字节`);
        } else {
          logToFile(`警告: 文件写入后不存在: ${filePath}`);
        }

        return {
          success: true,
          originalUrl: url,
          localPath: filePath,
          inTable,
        };
      } catch (writeErr) {
        logToFile(`写入文件时出错: ${writeErr.message}`);
        logToFile(`错误堆栈: ${writeErr.stack}`);

        // 尝试在系统临时目录写入
        try {
          const os = require("os");
          const tmpDir = os.tmpdir();
          const tmpFilePath = path.join(tmpDir, fileName);
          logToFile(`尝试写入临时文件: ${tmpFilePath}`);
          fs.writeFileSync(tmpFilePath, response.data);
          logToFile(`临时文件写入成功: ${tmpFilePath}`);
          return {
            success: true,
            originalUrl: url,
            localPath: tmpFilePath,
            inTable,
          };
        } catch (tmpErr) {
          logToFile(`写入临时文件也失败: ${tmpErr.message}`);
          return { success: false, originalUrl: url, localPath: null, inTable };
        }
      }
    } catch (requestErr) {
      logToFile(`图片请求失败: ${requestErr.message}`);
      if (requestErr.response) {
        logToFile(`响应状态: ${requestErr.response.status}`);
        logToFile(`响应头: ${JSON.stringify(requestErr.response.headers)}`);
      }
      throw requestErr; // 重新抛出以便外层捕获
    }
  } catch (error) {
    logToFile(`下载图片 #${index} 整体处理失败 ${url}: ${error.message}`);
    logToFile(`错误堆栈: ${error.stack}`);
    return { success: false, originalUrl: url, localPath: null, inTable };
  }
}

/**
 * 将文件名转换为安全的格式
 * @param {string} fileName - 原始文件名
 * @returns {string} - 安全的文件名
 */
function sanitizeFilename(fileName) {
  // 移除不安全字符，替换空格为下划线
  return fileName
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^\x00-\x7F]/g, "") // 移除非ASCII字符
    .substring(0, 100); // 限制长度
}
