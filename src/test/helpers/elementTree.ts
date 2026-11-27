/**
 * Minimal element-tree walker for interaction tests without a DOM. It expands hookless function
 * components by calling them, so a test can find a rendered button and invoke its onClick the
 * way a user's click would, then assert on the callback it fires.
 */
import { isValidElement, type ReactElement, type ReactNode } from 'react';

export type Props = Record<string, unknown> & { children?: ReactNode };
export type Element = ReactElement<Props>;

export function flatten(node: ReactNode): Element[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') return [];
  if (Array.isArray(node)) return node.flatMap((n: ReactNode) => flatten(n));
  if (!isValidElement<Props>(node)) return [];
  if (typeof node.type === 'function') {
    const render = node.type as (p: Props) => ReactNode;
    return flatten(render(node.props));
  }
  return [node, ...flatten(node.props.children)];
}

/** Concatenated text of an element and its descendants (hookless components expanded). */
export function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') return String(node);
  if (Array.isArray(node)) return node.map((n: ReactNode) => textOf(n)).join('');
  if (!isValidElement<Props>(node)) return '';
  if (typeof node.type === 'function') {
    const render = node.type as (p: Props) => ReactNode;
    return textOf(render(node.props));
  }
  return textOf(node.props.children);
}

export function buttons(node: ReactNode): Element[] {
  return flatten(node).filter((e) => e.type === 'button');
}

/** Find the one button whose data attribute (e.g. data-concept-id) has the given value. */
export function buttonBy(node: ReactNode, attr: string, value: string): Element {
  const found = buttons(node).filter((b) => b.props[attr] === value);
  if (found.length !== 1) throw new Error(`expected one button with ${attr}=${value}, found ${found.length}`);
  const [only] = found;
  if (!only) throw new Error('unreachable');
  return only;
}

/** Invoke a button's onClick, as a click would. */
export function press(el: Element): void {
  const onClick = el.props.onClick;
  if (typeof onClick !== 'function') throw new Error('element has no onClick');
  (onClick as () => void)();
}
