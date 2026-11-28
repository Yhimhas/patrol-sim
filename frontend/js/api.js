/** 后端请求封装：统一处理超时、网络故障和错误响应格式。 */
const API = (() => {
  async function requestJSON(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      let response;
      try {
        response = await fetch(path, { ...options, cache: "no-store", signal: controller.signal });
      } catch (error) {
        throw new Error(
          error.name === "AbortError"
            ? "请求超时，最新状态尚未确认，请重新读取状态。"
            : "无法连接服务，最新状态尚未确认，请检查服务后重新读取状态。"
        );
      }
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("服务响应无法解析，最新状态尚未确认，请重新读取状态。");
      }
      if (!response.ok) {
        throw new Error(data?.error?.message || `请求失败（HTTP ${response.status}），请重新读取状态。`);
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  return { requestJSON };
})();
