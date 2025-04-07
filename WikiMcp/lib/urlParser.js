// urlParser.js - Confluence URL解析模块

/**
 * 解析Confluence Wiki链接
 * 支持以下格式:
 * - http://yourcompany.com/confluence/display/SPACEKEY/Page+Title
 * - http://yourcompany.com/confluence/pages/viewpage.action?pageId=123456
 * - http://yourcompany.com/confluence/spaces/SPACEKEY/pages/123456/Page+Title
 * @param {string} url - Confluence页面URL
 * @returns {Object} - 解析后的参数对象 {baseUrl, spaceKey, contentId, title}
 */
export function parseConfluenceUrl(url) {
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
