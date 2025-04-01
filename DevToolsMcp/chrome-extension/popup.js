/**
 * 错误捕获MCP扩展 - 弹出页面脚本
 */

// 当前选中的错误
let selectedError = null;

// 服务器连接配置
let config = {
  serverUrl: "http://localhost:3000",
  enabled: true,
  captureGlobalErrors: true,
  capturePromiseRejections: true,
  captureConsoleErrors: true,
  notificationsEnabled: true,
};

// 初始化页面
document.addEventListener("DOMContentLoaded", async () => {
  // 加载配置
  await loadConfig();

  // 设置事件监听器
  setupEventListeners();

  // 加载错误列表
  await loadErrors();
});

// 设置事件监听器
function setupEventListeners() {
  // 标签页切换
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabId = tab.getAttribute("data-tab");

      // 更新活动标签
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(`${tabId}-tab`).classList.add("active");
    });
  });

  // 启用/禁用切换
  const enableToggle = document.getElementById("enableToggle");
  enableToggle.checked = config.enabled;
  enableToggle.addEventListener("change", async () => {
    config.enabled = enableToggle.checked;
    await saveConfig();
  });

  // 刷新错误列表
  document
    .getElementById("refresh-errors")
    .addEventListener("click", loadErrors);

  // 清除所有错误
  document
    .getElementById("clear-errors")
    .addEventListener("click", clearErrors);

  // 返回错误列表
  document.getElementById("back-to-list").addEventListener("click", () => {
    document.getElementById("error-details").style.display = "none";
    document.getElementById("error-list").style.display = "block";
  });

  // 分析错误
  document
    .getElementById("analyze-error")
    .addEventListener("click", analyzeError);

  // 设置表单提交
  document
    .getElementById("settings-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      config = {
        serverUrl: document.getElementById("serverUrl").value,
        enabled: config.enabled,
        captureGlobalErrors: document.getElementById("captureGlobalErrors")
          .checked,
        capturePromiseRejections: document.getElementById(
          "capturePromiseRejections"
        ).checked,
        captureConsoleErrors: document.getElementById("captureConsoleErrors")
          .checked,
        notificationsEnabled: document.getElementById("notificationsEnabled")
          .checked,
      };

      await saveConfig();

      // 提示保存成功
      alert("设置已保存");
    });

  // 重置默认设置
  document
    .getElementById("reset-settings")
    .addEventListener("click", async () => {
      const defaultConfig = {
        serverUrl: "http://localhost:3000",
        enabled: true,
        captureGlobalErrors: true,
        capturePromiseRejections: true,
        captureConsoleErrors: true,
        notificationsEnabled: true,
      };

      // 更新UI
      document.getElementById("serverUrl").value = defaultConfig.serverUrl;
      document.getElementById("captureGlobalErrors").checked =
        defaultConfig.captureGlobalErrors;
      document.getElementById("capturePromiseRejections").checked =
        defaultConfig.capturePromiseRejections;
      document.getElementById("captureConsoleErrors").checked =
        defaultConfig.captureConsoleErrors;
      document.getElementById("notificationsEnabled").checked =
        defaultConfig.notificationsEnabled;

      // 保存配置
      config = defaultConfig;
      await saveConfig();

      alert("已重置为默认设置");
    });
}

// 加载配置
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_CONFIG" }, (response) => {
      if (response && response.config) {
        config = response.config;

        // 更新UI
        document.getElementById("enableToggle").checked = config.enabled;
        document.getElementById("serverUrl").value = config.serverUrl;
        document.getElementById("captureGlobalErrors").checked =
          config.captureGlobalErrors;
        document.getElementById("capturePromiseRejections").checked =
          config.capturePromiseRejections;
        document.getElementById("captureConsoleErrors").checked =
          config.captureConsoleErrors;
        document.getElementById("notificationsEnabled").checked =
          config.notificationsEnabled;
      }

      resolve();
    });
  });
}

// 保存配置
async function saveConfig() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "UPDATE_CONFIG",
        config: config,
      },
      () => {
        // 向当前活动标签页发送消息，更新配置
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: "UPDATE_CONFIG",
              config: config,
            });
          }
        });

        resolve();
      }
    );
  });
}

// 加载错误列表
async function loadErrors() {
  // 显示加载中
  document.getElementById("loading-errors").style.display = "block";
  document.getElementById("error-list").style.display = "none";
  document.getElementById("no-errors").style.display = "none";

  // 获取当前活动标签页的错误
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { type: "GET_ERRORS" },
        (response) => {
          document.getElementById("loading-errors").style.display = "none";

          if (chrome.runtime.lastError) {
            // 内容脚本可能未加载
            document.getElementById("no-errors").textContent =
              "无法连接到页面内容脚本";
            document.getElementById("no-errors").style.display = "block";
            return;
          }

          if (!response || !response.errors || response.errors.length === 0) {
            document.getElementById("no-errors").style.display = "block";
            return;
          }

          renderErrorList(response.errors);
        }
      );
    } else {
      document.getElementById("loading-errors").style.display = "none";
      document.getElementById("no-errors").textContent = "无法获取当前标签页";
      document.getElementById("no-errors").style.display = "block";
    }
  });
}

// 渲染错误列表
function renderErrorList(errors) {
  const errorListElement = document.getElementById("error-list");
  errorListElement.innerHTML = "";

  errors.forEach((error) => {
    const errorItem = document.createElement("div");
    errorItem.className = "error-item";
    errorItem.innerHTML = `
      <div class="error-message">${truncateText(error.message, 80)}</div>
      <div class="error-url">${error.url || "Unknown URL"}</div>
      <div class="error-time">${formatTimestamp(error.timestamp)}</div>
    `;

    // 点击显示详情
    errorItem.addEventListener("click", () => {
      selectedError = error;
      showErrorDetails(error);
    });

    errorListElement.appendChild(errorItem);
  });

  errorListElement.style.display = "block";
}

// 显示错误详情
function showErrorDetails(error) {
  document.getElementById("error-list").style.display = "none";
  document.getElementById("error-details").style.display = "block";
  document.getElementById("error-analysis").style.display = "none";

  const detailsElement = document.getElementById("selected-error-info");

  let detailsHtml = `
    <div class="error-message">${error.message}</div>
    <div class="error-url">URL: ${error.url || "Unknown"}</div>
  `;

  if (error.line && error.column) {
    detailsHtml += `<div>位置: 行 ${error.line}, 列 ${error.column}</div>`;
  }

  if (error.context) {
    detailsHtml += `<div>上下文: ${error.context}</div>`;
  }

  if (error.timestamp) {
    detailsHtml += `<div>时间: ${formatTimestamp(error.timestamp)}</div>`;
  }

  if (error.stack) {
    detailsHtml += `
      <h4>堆栈追踪</h4>
      <div class="error-stack">${error.stack}</div>
    `;
  }

  detailsElement.innerHTML = detailsHtml;
}

// 分析错误
async function analyzeError() {
  if (!selectedError) {
    return;
  }

  const analyzeButton = document.getElementById("analyze-error");
  const suggestionsElement = document.getElementById("error-suggestions");

  // 更新UI
  analyzeButton.textContent = "分析中...";
  analyzeButton.disabled = true;

  try {
    // 通过Fetch API调用MCP服务器
    const response = await fetch(
      `${config.serverUrl}/api/errors/${selectedError.id}/analyze`,
      {
        method: "GET",
      }
    );

    if (response.ok) {
      const result = await response.json();

      // 显示分析结果
      document.getElementById("error-analysis").style.display = "block";
      suggestionsElement.textContent = result.suggestions || "无法生成具体建议";
    } else {
      // 如果分析失败，尝试使用预设的建议
      document.getElementById("error-analysis").style.display = "block";

      // 根据错误类型提供基本建议
      let suggestions = generateBasicSuggestions(selectedError);
      suggestionsElement.textContent = suggestions;
    }
  } catch (err) {
    console.error("分析错误失败:", err);

    // 显示本地生成的建议
    document.getElementById("error-analysis").style.display = "block";
    suggestionsElement.textContent =
      "无法连接到MCP服务器进行分析。\n\n基本建议:\n" +
      generateBasicSuggestions(selectedError);
  } finally {
    // 恢复按钮状态
    analyzeButton.textContent = "分析错误";
    analyzeButton.disabled = false;
  }
}

// 生成基本建议
function generateBasicSuggestions(error) {
  const message = error.message || "";

  if (message.includes("is not defined")) {
    const varName = message.split(" is not defined")[0].trim();
    return `可能的问题: 变量 '${varName}' 未定义\n\n建议:\n1. 检查变量名拼写是否正确\n2. 确保在使用前声明该变量\n3. 检查变量是否在正确的作用域中`;
  } else if (message.includes("is not a function")) {
    const funcName = message.split(" is not a function")[0].trim();
    return `可能的问题: '${funcName}' 不是一个函数\n\n建议:\n1. 检查对象/变量是否正确初始化\n2. 确保函数名拼写正确\n3. 检查是否尝试调用一个不是函数的值`;
  } else if (message.includes("Cannot read property")) {
    return `可能的问题: 尝试访问undefined或null对象的属性\n\n建议:\n1. 在访问属性前检查对象是否存在\n2. 使用可选链操作符 (?.) 安全访问属性\n3. 确保API响应或函数返回了预期的对象结构`;
  } else if (message.includes("Unexpected token")) {
    return `可能的问题: 语法错误\n\n建议:\n1. 检查括号、引号、大括号是否匹配\n2. 检查是否遗漏了分号或逗号\n3. 验证JSON格式是否有效`;
  } else {
    return `基本建议:\n1. 检查相关代码逻辑\n2. 确保所有变量在使用前已声明\n3. 检查是否有类型错误\n4. 在关键代码周围添加try/catch块`;
  }
}

// 清除所有错误
function clearErrors() {
  // 重置徽章计数
  chrome.runtime.sendMessage({ type: "RESET_ERROR_COUNT" });

  // 清除当前活动标签页的错误
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "CLEAR_ERRORS" }, () => {
        loadErrors();
      });
    }
  });

  // 清除服务器上的错误
  fetch(`${config.serverUrl}/api/errors`, {
    method: "DELETE",
  }).catch((err) => {
    console.error("清除服务器错误失败:", err);
  });
}

// 辅助函数 - 格式化时间戳
function formatTimestamp(timestamp) {
  if (!timestamp) return "Unknown time";

  const date = new Date(timestamp);
  return date.toLocaleString();
}

// 辅助函数 - 截断文本
function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}
