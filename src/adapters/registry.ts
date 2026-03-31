/**
 * 适配器注册表 — 根据配置创建适配器实例。
 * 新协议只需: (1) 实现 TransportAdapter, (2) 在此处注册。
 */
import type { TransportAdapter, AdapterConfig, AdapterAuth } from "./types.js";

type AdapterFactory = (config: AdapterConfig) => TransportAdapter;

interface AdapterRegistration {
  factory: AdapterFactory;
  auth?: AdapterAuth;
}

const registry = new Map<string, AdapterRegistration>();

export function registerAdapter(type: string, factory: AdapterFactory, auth?: AdapterAuth): void {
  registry.set(type, { factory, auth });
}

export function createAdapter(config: AdapterConfig): TransportAdapter {
  const registration = registry.get(config.type);
  if (!registration) {
    throw new Error(`未知适配器类型: "${config.type}"。已注册: ${[...registry.keys()].join(", ")}`);
  }
  return registration.factory(config);
}

export function getAdapterAuth(type: string): AdapterAuth | undefined {
  return registry.get(type)?.auth;
}

export function getRegisteredTypes(): string[] {
  return [...registry.keys()];
}
