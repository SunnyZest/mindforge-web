/**
 * 带有自动退避重试的异步分包加载器。
 *
 * 解决前端工程中两类常见的模块拉取异常：
 * 1. Vite 开发模式下，首次进入包含新依赖的动态页面时，Vite 依赖优化重构（optimizeDeps）导致模块拉取中断；
 * 2. 生产环境中，微前端发布或前端资源热更新时旧 chunk 散列短暂失效。
 *
 * 包装后，一旦首次 import 抛出网络或分包拉取异常，会在指定延迟后自动重试（默认重试 2 次），
 * 确保组件平滑加载完成，杜绝因初次动态导入失败导致路由守卫回滚或出现“需要点击第二次才跳转”。
 */
export function lazyView<T>(
  loader: () => Promise<T>,
  retries = 2,
  delayMs = 150,
): () => Promise<T> {
  return () =>
    new Promise<T>((resolve, reject) => {
      function attempt(left: number): void {
        loader()
          .then(resolve)
          .catch((err: unknown) => {
            if (left <= 0) {
              reject(err)
              return
            }
            setTimeout(() => {
              attempt(left - 1)
            }, delayMs)
          })
      }
      attempt(retries)
    })
}
