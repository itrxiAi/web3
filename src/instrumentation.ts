/**
 * Next.js 启动钩子（仅 nodejs runtime 执行一次）。
 *
 * 在这里预热 RAILGUN 引擎：在「任何请求作用域之外」完成 startRailgunEngine + loadProvider，
 * 避免在 API 路由请求内初始化时继承 Next.js 改写过的请求作用域 fetch（会导致 provider
 * 健康检查 getBlockNumber 失败）。预热后，shield 请求只需调用 populateShield 构造 calldata。
 */
export async function register() {
  // 注意：不能在 instrumentation 里 import RAILGUN（该编译层不应用 serverExternalPackages，
  // 会把 @railgun-community/* 连同 node 内置依赖一起打包导致构建失败）。
  // 引擎改为在 API 路由内懒加载（那里 externals 生效）。
}
