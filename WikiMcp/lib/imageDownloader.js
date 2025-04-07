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
    // 创建唯一的文件夹名
    const folderHash = crypto
      .createHash("md5")
      .update(pageId || Date.now().toString())
      .digest("hex")
      .substring(0, 8);
    const pageName = sanitizeFilename(extractedContent.title || "wiki_page");
    const imageFolderName = `${pageName}_${folderHash}`;

    // 在桌面创建图片存放文件夹
    const desktopPath = path.join(
      process.env.HOME || process.env.USERPROFILE,
      "Desktop"
    );
    const wikiImageBasePath = path.join(desktopPath, "WikiImages");
    const imageFolderPath = path.join(wikiImageBasePath, imageFolderName);

    // 创建目录结构
    if (!fs.existsSync(wikiImageBasePath)) {
      fs.mkdirSync(wikiImageBasePath, { recursive: true });
    }

    if (!fs.existsSync(imageFolderPath)) {
      fs.mkdirSync(imageFolderPath, { recursive: true });
    }

    logToFile(`创建图片存放文件夹: ${imageFolderPath}`);

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
        continue;
      }

      imagePromises.push(
        downloadImage(src, imageFolderPath, i, baseUrl, headers, inTable)
          .then(({ success, originalUrl, localPath, inTable }) => {
            if (success) {
              // 存储原始URL到本地相对路径的映射
              const relativePath = `./WikiImages/${imageFolderName}/${path.basename(
                localPath
              )}`;
              imageMap.set(originalUrl, relativePath);
              logToFile(
                `已下载图片: ${originalUrl} -> ${relativePath}${
                  inTable ? " (表格中)" : ""
                }`
              );
            }
          })
          .catch((error) => {
            logToFile(`下载图片失败 ${src}: ${error.message}`);
          })
      );
    }

    // 等待所有图片下载完成
    await Promise.all(imagePromises);

    return { imageMap, imageFolderPath };
  } catch (error) {
    logToFile(`处理图片时出错: ${error.message}`);
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

    logToFile(`下载图片: ${fullUrl}${inTable ? " (表格中)" : ""}`);

    // 获取图片
    const response = await axios.get(fullUrl, {
      responseType: "arraybuffer",
      headers,
      timeout: 10000, // 10秒超时
      maxRedirects: 5,
    });

    // 确定文件扩展名
    const contentType = response.headers["content-type"];
    let extension = ".png"; // 默认扩展名

    if (contentType) {
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
      const urlExt = path.extname(new URL(fullUrl).pathname).toLowerCase();
      if (
        urlExt &&
        [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"].includes(urlExt)
      ) {
        extension = urlExt;
      }
    }

    // 生成文件名 - 使用索引和原始文件名的组合
    let originalFileName;
    try {
      originalFileName = path.basename(new URL(fullUrl).pathname);
      // 如果原始文件名太长或包含奇怪字符，使用索引作为文件名
      if (
        originalFileName.length > 50 ||
        !/^[a-zA-Z0-9._-]+$/.test(originalFileName)
      ) {
        originalFileName = `image_${index}${extension}`;
      }
    } catch (e) {
      originalFileName = `image_${index}${extension}`;
    }

    // 添加表格标记以便于识别
    const tableIndicator = inTable ? "_table" : "";

    // 确保文件名安全且唯一
    const fileName = `${index}${tableIndicator}_${sanitizeFilename(
      originalFileName
    )}`;
    const filePath = path.join(folderPath, fileName);

    // 写入文件
    fs.writeFileSync(filePath, response.data);

    return { success: true, originalUrl: url, localPath: filePath, inTable };
  } catch (error) {
    logToFile(`下载图片失败 ${url}: ${error.message}`);
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
