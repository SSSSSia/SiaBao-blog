/**
 * utils.js — Constellation 通用小工具
 *
 * 当前仅 cx：极简 className 拼接器（替代 clsx，零依赖）。
 * 用法：cx('foo', cond && 'bar', baz ? 'qux' : null) → "foo bar"
 */

/** 过滤 falsy 后用空格拼接，得到最终 className 字符串。 */
export const cx = (...parts) => parts.filter(Boolean).join(' ');
