/**
 * 交互式登录菜单 — 提供凭证选择、新用户登录、退出选项
 * @returns 选中的凭证索引，-1 表示退出，-2 表示需要重新选择（如删除后）
 */
import { getAdapterAuth } from "../adapters/registry.js";
import { logger } from "../utils/logger.js";
import readline from "node:readline";

export async function selectCredentialsOrLogin(adapterId: string): Promise<number> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  const auth = getAdapterAuth(adapterId);
  if (!auth) {
    rl.close();
    throw new Error(`适配器 "${adapterId}" 不支持登录功能`);
  }

  // 获取完整的凭证列表（用于修改别名等操作）
  const getFullCredentials = async () => {
    const { loadAdapterCredentials } = await import("./credentials.js");
    return loadAdapterCredentials(adapterId);
  };

  while (true) {
    console.log(`\n=== ${adapterId} 适配器登录 ===`);

    // 加载并显示已有凭证
    const credentials = auth.listCredentials();
    const fullCredentials = await getFullCredentials();

    if (credentials.length > 0) {
      console.log("\n已有账号：");
      credentials.forEach((cred, idx) => {
        console.log(`  ${idx + 1}. ${cred.accountId}`);
      });
      console.log(`  ${credentials.length + 1}. 新用户登录（扫码）`);
      console.log(`  ${credentials.length + 2}. 修改别名`);
      console.log(`  ${credentials.length + 3}. 删除账号`);
      console.log(`  ${credentials.length + 4}. 退出`);
    } else {
      console.log("\n暂无已保存的账号");
      console.log("  1. 新用户登录（扫码）");
      console.log("  2. 退出");
    }

    const choice = await question("\n请选择 (输入数字): ");
    const choiceNum = parseInt(choice.trim(), 10);

    const maxOption = credentials.length > 0 ? credentials.length + 4 : 2;
    if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > maxOption) {
      console.log("❌ 无效选择，请重新输入");
      continue;
    }

    // 退出选项
    const exitIndex = credentials.length > 0 ? credentials.length + 4 : 2;
    if (choiceNum === exitIndex) {
      rl.close();
      return -1; // 退出
    }

    // 删除账号选项
    if (credentials.length > 0 && choiceNum === credentials.length + 3) {
      const deleteChoice = await question(`请选择要删除的账号 (1-${credentials.length}, 0 取消): `);
      const deleteNum = parseInt(deleteChoice.trim(), 10);

      if (deleteNum === 0) {
        continue;
      }

      if (isNaN(deleteNum) || deleteNum < 1 || deleteNum > credentials.length) {
        console.log("❌ 无效选择");
        continue;
      }

      try {
        auth.deleteCredential(deleteNum - 1);
        console.log("✅ 已删除该账号");
      } catch (err) {
        console.log(`❌ 删除失败: ${err instanceof Error ? err.message : String(err)}`);
      }
      continue; // 返回菜单重新显示
    }

    // 修改别名选项
    if (credentials.length > 0 && choiceNum === credentials.length + 2) {
      const aliasChoice = await question(`请选择要修改别名的账号 (1-${credentials.length}, 0 取消): `);
      const aliasNum = parseInt(aliasChoice.trim(), 10);

      if (aliasNum === 0) {
        continue;
      }

      if (isNaN(aliasNum) || aliasNum < 1 || aliasNum > credentials.length) {
        console.log("❌ 无效选择");
        continue;
      }

      const targetCred = fullCredentials[aliasNum - 1];
      const userId = targetCred.userId as string;

      // 临时关闭当前 rl，使用 updateAlias 的 readline
      rl.close();

      // 调用 updateAlias 函数（需要在 ilink.ts 中导出）
      const { updateAlias } = await import("../adapters/ilink.js");
      await updateAlias(userId);

      // 重新创建 rl 用于后续输入
      return -2; // 返回 -2 让菜单重新显示
    }

    // 新用户登录选项
    const newLoginIndex = credentials.length > 0 ? credentials.length + 1 : 1;
    if (choiceNum === newLoginIndex) {
      rl.close();
      const success = await auth.login();
      if (success) {
        console.log("\n✅ 登录成功！请重新选择账号登录。");
        // 登录后返回 -2，让主流程重新调用菜单
        return -2;
      }
      console.log("\n❌ 登录失败");
      return -1;
    }

    // 选择已有凭证（返回 0-based 索引）
    rl.close();
    return choiceNum - 1;
  }
}
