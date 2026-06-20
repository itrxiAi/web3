import 'server-only';
import fs from 'fs';
import path from 'path';
import {
  startRailgunEngine,
  loadProvider,
  ArtifactStore,
  setLoggers,
} from '@railgun-community/wallet';
import { NetworkName } from '@railgun-community/shared-models';
// leveldown is a native LevelDOWN-compatible store, used only on the Node server.
// eslint-disable-next-line @typescript-eslint/no-var-requires
import LevelDownDB from 'leveldown';

/**
 * RAILGUN 引擎（仅 shield 用途）。
 *
 * 本服务只需要把激活的系统份额 shield 进 RAILGUN 私密池，**不读取私有余额、不做私密转账/unshield**，
 * 因此用 shield-only 模式：startRailgunEngine 的 skipMerkletreeScans=true，引擎不会同步默克尔树、
 * 不做余额扫描，初始化与运行开销很小。国库资金的查询与花费由官方 RAILGUN Wallet 手动完成。
 */

const ENGINE_DB_PATH = process.env.RAILGUN_DB_PATH ?? path.join(process.cwd(), '.railgun', 'engine.db');
const ENGINE_ARTIFACTS_PATH =
  process.env.RAILGUN_ARTIFACTS_PATH ?? path.join(process.cwd(), '.railgun', 'artifacts');

/** BSC RPC 列表（与项目其它地方一致，逗号分隔，回退到官方公共节点）。
 *  优先用项目统一的 NEXT_PUBLIC_CHAIN_RPC_URL（同 utils/chain.ts），再到 BSC_RPC_URLS。 */
function bscProviderConfig() {
  const urls = (
    process.env.BSC_RPC_URLS ??
    process.env.NEXT_PUBLIC_CHAIN_RPC_URL ??
    process.env.NEXT_PUBLIC_BSC_RPC ??
    'https://bsc-dataseed.binance.org'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    chainId: 56,
    // RAILGUN 要求所有 provider 权重之和 >= 2（fallback 仲裁）。单节点时给 weight=2。
    providers: urls.map((url, i) => ({
      provider: url,
      priority: i + 1,
      weight: 2,
      stallTimeout: 2500,
      maxLogsPerBatch: 10,
    })),
  };
}

function createArtifactStore(documentsDir: string): ArtifactStore {
  const full = (p: string) => `${documentsDir}/${p}`;
  return new ArtifactStore(
    async (p: string) => fs.promises.readFile(full(p)),
    async (dir: string, p: string, item: string | Uint8Array) => {
      await fs.promises.mkdir(full(dir), { recursive: true });
      await fs.promises.writeFile(full(p), item);
    },
    (p: string) =>
      new Promise<boolean>((resolve) => {
        fs.promises
          .access(full(p))
          .then(() => resolve(true))
          .catch(() => resolve(false));
      }),
  );
}

/**
 * 判断错误是否为 LevelDB 损坏/打不开（应清库重建）。
 * 典型：OpenError + "IO error" / "MANIFEST" / "no such file or directory" / "corrupt"。
 */
function isLevelDbCorruption(err: unknown): boolean {
  let cur: unknown = err;
  let depth = 0;
  while (cur && depth < 8) {
    const e = cur as { name?: string; message?: string; cause?: unknown };
    const name = (e?.name ?? '').toLowerCase();
    const msg = (e?.message ?? '').toLowerCase();
    if (
      name.includes('openerror') ||
      msg.includes('manifest') ||
      msg.includes('io error') ||
      msg.includes('corrupt') ||
      msg.includes('no such file or directory')
    ) {
      return true;
    }
    cur = e?.cause;
    depth++;
  }
  return false;
}

let enginePromise: Promise<void> | null = null;

/** 懒加载、进程内单例地初始化 RAILGUN 引擎并加载 BSC provider。 */
export async function ensureRailgunEngine(): Promise<void> {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    fs.mkdirSync(ENGINE_ARTIFACTS_PATH, { recursive: true });
    const artifactStore = createArtifactStore(ENGINE_ARTIFACTS_PATH);

    // 在 CJS 上下文内捕获 RAILGUN 内部真实错误（cause 跨 webpack 边界会丢失）
    setLoggers(
      () => {
        /* ignore info logs */
      },
      (err: unknown) => {
        const e = err as { message?: string; stack?: string };
        console.error('[railgun][engine.error]', e?.message ?? err, '\n', e?.stack ?? '');
      },
    );

    const ppoiNodes = (process.env.RAILGUN_POI_NODES ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const startEngine = async () => {
      fs.mkdirSync(ENGINE_DB_PATH, { recursive: true });
      const db = LevelDownDB(ENGINE_DB_PATH);
      await startRailgunEngine(
        'harmonylink',     // walletSource，<=16 字符小写
        db,
        false,             // shouldDebug
        artifactStore,
        false,             // useNativeArtifacts（nodejs 用 wasm）
        true,              // skipMerkletreeScans —— shield-only，跳过同步/余额扫描
        ppoiNodes,         // Private POI 聚合节点（生产请配置自有/社区节点）
        [],                // customPOILists
        false,             // verboseScanLogging
      );
    };

    try {
      await startEngine();
    } catch (err) {
      // 仅在 LevelDB 损坏（如 MANIFEST 丢失导致 OpenError）时清库重建并重试一次。
      // shield-only 模式下该 db 仅为本地缓存，不含私钥/余额，删除安全。
      if (!isLevelDbCorruption(err)) throw err;
      console.warn(
        `[railgun] engine.db corrupted (${(err as Error)?.message}); wiping ${ENGINE_DB_PATH} and rebuilding once...`,
      );
      fs.rmSync(ENGINE_DB_PATH, { recursive: true, force: true });
      await startEngine();
    }

    // 加载 BSC provider（loadProvider 会读取 RAILGUN 合约与费率）。
    // RPC 冷连接偶发 socket hang up / ECONNRESET，做有限重试。
    const pollingInterval = 1000 * 60 * 5; // 5 min
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await loadProvider(bscProviderConfig(), NetworkName.BNBChain, pollingInterval);
        break;
      } catch (err) {
        if (attempt >= maxAttempts) throw err;
        console.warn(`[railgun] loadProvider attempt ${attempt} failed, retrying...`);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  })().catch((e) => {
    // 失败时重置，允许下次重试
    enginePromise = null;
    // 以纯字符串打印 cause 链（避免 Next 错误覆盖层吞掉 cause）
    let cur: unknown = e;
    let depth = 0;
    const lines: string[] = [];
    while (cur && depth < 8) {
      const err = cur as { message?: string; cause?: unknown; name?: string };
      lines.push(`[${depth}] ${err?.name ?? ''}: ${err?.message ?? String(cur)}`);
      cur = err?.cause;
      depth++;
    }
    console.error('[railgun] CAUSE CHAIN:\n' + lines.join('\n'));
    throw e;
  });
  return enginePromise;
}

export const RAILGUN_NETWORK = NetworkName.BNBChain;
