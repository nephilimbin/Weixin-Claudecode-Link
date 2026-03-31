/**
 * iLink 协议类型定义 — 基于 @tencent-weixin/openclaw-weixin 简化。
 * 协议为 JSON over HTTP，bytes 字段使用 base64 编码。
 */

export interface BaseInfo {
  channel_version?: string;
}

export const MessageType = {
  NONE: 0,
  USER: 1,
  BOT: 2,
} as const;

export const MessageItemType = {
  NONE: 0,
  TEXT: 1,
  IMAGE: 2,
  VOICE: 3,
  FILE: 4,
  VIDEO: 5,
} as const;

export const MessageState = {
  NEW: 0,
  GENERATING: 1,
  FINISH: 2,
} as const;

export interface TextItem {
  text?: string;
}

export interface VoiceItem {
  text?: string; // 语音 ASR 转写文本
  encode_type?: number;
  playtime?: number;
}

export interface MessageItem {
  type?: number;
  text_item?: TextItem;
  voice_item?: VoiceItem;
  ref_msg?: { title?: string; message_item?: MessageItem };
}

export interface WeixinMessage {
  seq?: number;
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  client_id?: string;
  session_id?: string;
  group_id?: string;
  message_type?: number;
  message_state?: number;
  item_list?: MessageItem[];
  context_token?: string;
  create_time_ms?: number;
}

export interface GetUpdatesReq {
  get_updates_buf?: string;
}

export interface GetUpdatesResp {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeixinMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}

export interface SendMessageReq {
  msg?: WeixinMessage;
}

export interface GetConfigResp {
  ret?: number;
  errmsg?: string;
  typing_ticket?: string;
}

export interface SendTypingReq {
  ilink_user_id?: string;
  typing_ticket?: string;
  status?: number;
}

export const TypingStatus = {
  TYPING: 1,
  CANCEL: 2,
} as const;
