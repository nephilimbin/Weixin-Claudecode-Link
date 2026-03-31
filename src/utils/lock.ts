/**
 * 进程锁 — 防止同一账号被多次启动
 * 基于 PID 文件实现，进程退出时自动释放
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const LOCKS_DIR = path.join(os.homedir(), ".weixin-claudecode-link", "locks");

function ensureLocksDir() {
  fs.mkdirSync(LOCKS_DIR, { recursive: true });
}

/**
 * 进程锁类
 */
export class ProcessLock {
  private readonly lockPath: string;
  private readonly pid: number;

  constructor(adapterId: string, userId: string) {
    // 使用 URL 编码处理特殊字符
    const safeUserId = encodeURIComponent(userId);
    this.lockPath = path.join(LOCKS_DIR, `${adapterId}-${safeUserId}.pid`);
    this.pid = process.pid;
  }

  /**
   * 尝试获取锁
   * @returns 是否成功获取锁
   */
  tryAcquire(): { success: boolean; ownerPid?: number } {
    ensureLocksDir();

    // 检查锁文件是否存在
    if (fs.existsSync(this.lockPath)) {
      try {
        const content = fs.readFileSync(this.lockPath, "utf-8");
        const ownerPid = parseInt(content.trim(), 10);

        // 如果是当前进程的锁，直接返回成功（可能是重复调用）
        if (ownerPid === this.pid) {
          return { success: true };
        }

        // 检查进程是否还在运行
        if (this.isProcessAlive(ownerPid)) {
          return { success: false, ownerPid };
        }
        // 进程已不存在，清理旧锁文件
        fs.unlinkSync(this.lockPath);
      } catch {
        // 读取失败，视为锁无效
      }
    }

    // 创建新锁文件
    fs.writeFileSync(this.lockPath, this.pid.toString());
    return { success: true };
  }

  /**
   * 释放锁
   */
  release(): void {
    try {
      if (fs.existsSync(this.lockPath)) {
        fs.unlinkSync(this.lockPath);
      }
    } catch {
      // 忽略错误
    }
  }

  /**
   * 检查进程是否存活
   */
  private isProcessAlive(pid: number): boolean {
    try {
      // POSIX 系统使用 kill(pid, 0) 检测进程
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 注册进程退出时自动释放锁
   */
  registerAutoRelease(): void {
    const releaseHandler = () => {
      this.release();
    };

    process.on("exit", releaseHandler);
    process.on("SIGINT", releaseHandler);
    process.on("SIGTERM", releaseHandler);
  }
}
