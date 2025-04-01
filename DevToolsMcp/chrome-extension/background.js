/**
 * 错误捕获MCP扩展 - 后台脚本
 * 管理与MCP服务器的通信
 */

// 存储配置
const defaultConfig = {
  enabled: true,
  serverUrl: "http://localhost:3000",
  captureGlobalErrors: true,
  capturePromiseRejections: true,
  captureConsoleErrors: true,
  notificationsEnabled: true,
};

// 错误计数（用于徽章显示）
let errorCount = 0;

// 初始化
async function init() {
  // 加载配置
  const { errorCatcherConfig } = await chrome.storage.sync.get([
    "errorCatcherConfig",
  ]);
  const config = errorCatcherConfig || defaultConfig;

  // 更新图标状态
  updateIcon(config.enabled);
}

// 监听扩展安装
chrome.runtime.onInstalled.addListener(() => {
  // 设置默认配置
  chrome.storage.sync.set({ errorCatcherConfig: defaultConfig });

  // 设置徽章文本
  chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  chrome.action.setBadgeText({ text: "" });

  // 生成并设置图标
  generateIcons();
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "NEW_ERROR") {
    // 增加错误计数
    errorCount++;
    updateBadge();

    // 获取配置
    const { errorCatcherConfig } = await chrome.storage.sync.get([
      "errorCatcherConfig",
    ]);
    const config = errorCatcherConfig || defaultConfig;

    // 显示通知（如果启用）
    if (config.notificationsEnabled) {
      showErrorNotification(message.error, sender.tab);
    }

    // 向MCP服务器报告（如果未在内容脚本中报告）
    try {
      await fetch(`${config.serverUrl}/api/errors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message.error),
      });
    } catch (e) {
      console.error("向MCP服务器报告错误失败:", e);
    }
  } else if (message.type === "GET_CONFIG") {
    const { errorCatcherConfig } = await chrome.storage.sync.get([
      "errorCatcherConfig",
    ]);
    sendResponse({ config: errorCatcherConfig || defaultConfig });
  } else if (message.type === "UPDATE_CONFIG") {
    // 保存新配置
    await chrome.storage.sync.set({ errorCatcherConfig: message.config });

    // 更新图标状态
    updateIcon(message.config.enabled);

    sendResponse({ success: true });
  } else if (message.type === "RESET_ERROR_COUNT") {
    errorCount = 0;
    updateBadge();
    sendResponse({ success: true });
  }

  return true; // 保持消息通道打开以进行异步响应
});

// 显示错误通知
function showErrorNotification(error, tab) {
  // 使用程序生成的图标作为通知图标
  const iconUrl = generateIconDataUrl(128, true);

  chrome.notifications.create({
    type: "basic",
    iconUrl: iconUrl,
    title: "检测到JavaScript错误",
    message: `页面 "${
      tab?.title || "未知"
    }" 中发生错误: ${error.message.substring(0, 150)}`,
    buttons: [{ title: "查看详情" }],
    priority: 1,
  });
}

// 监听通知点击
chrome.notifications.onClicked.addListener((notificationId) => {
  // 打开扩展弹窗
  chrome.action.openPopup();
});

// 生成所有图标并存储
function generateIcons() {
  // 激活状态图标
  generateIconAndSet(16, true);
  generateIconAndSet(48, true);
  generateIconAndSet(128, true);

  // 禁用状态图标
  generateIconAndSet(16, false);
  generateIconAndSet(48, false);
  generateIconAndSet(128, false);
}

// 生成并设置单个图标
function generateIconAndSet(size, enabled) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // 绘制图标背景
  ctx.fillStyle = enabled ? "#4285f4" : "#cccccc";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
  ctx.fill();

  // 绘制错误符号
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", size / 2, size / 2);

  // 转换为Blob，然后转为URL
  canvas.convertToBlob().then((blob) => {
    const url = URL.createObjectURL(blob);

    // 存储图标URL，以便在updateIcon中使用
    chrome.storage.local.set({
      [`icon_${size}_${enabled ? "enabled" : "disabled"}`]: url,
    });
  });
}

// 生成图标的Data URL（用于通知）
function generateIconDataUrl(size, enabled) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // 绘制图标背景
  ctx.fillStyle = enabled ? "#4285f4" : "#cccccc";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
  ctx.fill();

  // 绘制错误符号
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", size / 2, size / 2);

  // 转换为Data URL
  return canvas.toDataURL();
}

// 更新扩展图标
function updateIcon(enabled) {
  // 检查图标URL是否已存储
  chrome.storage.local.get(
    [
      "icon_16_enabled",
      "icon_48_enabled",
      "icon_128_enabled",
      "icon_16_disabled",
      "icon_48_disabled",
      "icon_128_disabled",
    ],
    (result) => {
      // 如果图标URL存在，则使用它们
      if (
        enabled &&
        result.icon_16_enabled &&
        result.icon_48_enabled &&
        result.icon_128_enabled
      ) {
        chrome.action.setIcon({
          path: {
            16: result.icon_16_enabled,
            48: result.icon_48_enabled,
            128: result.icon_128_enabled,
          },
        });
      } else if (
        !enabled &&
        result.icon_16_disabled &&
        result.icon_48_disabled &&
        result.icon_128_disabled
      ) {
        chrome.action.setIcon({
          path: {
            16: result.icon_16_disabled,
            48: result.icon_48_disabled,
            128: result.icon_128_disabled,
          },
        });
      } else {
        // 如果URL不存在，则重新生成图标
        generateIcons();

        // 使用代码生成图标
        const canvas16 = new OffscreenCanvas(16, 16);
        const ctx16 = canvas16.getContext("2d");

        // 绘制图标
        ctx16.fillStyle = enabled ? "#4285f4" : "#cccccc";
        ctx16.beginPath();
        ctx16.arc(8, 8, 8, 0, 2 * Math.PI);
        ctx16.fill();

        ctx16.fillStyle = "#ffffff";
        ctx16.font = "bold 10px Arial";
        ctx16.textAlign = "center";
        ctx16.textBaseline = "middle";
        ctx16.fillText("!", 8, 8);

        // 转换为ImageData
        const imageData16 = ctx16.getImageData(0, 0, 16, 16);

        // 设置图标
        chrome.action.setIcon({
          imageData: {
            16: imageData16,
          },
        });
      }
    }
  );
}

// 更新徽章文本
function updateBadge() {
  chrome.action.setBadgeText({
    text: errorCount > 0 ? String(errorCount) : "",
  });
}

// 初始化扩展
init();
