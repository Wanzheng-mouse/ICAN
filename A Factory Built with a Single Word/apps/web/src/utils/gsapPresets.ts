/**
 * 全站 GSAP 动画预设
 * 导入方式：import { fadeInUp, staggerCards, countUp, ... } from '@/utils/gsapPresets';
 */
import gsap from 'gsap';

/** === 入场动画 === */

/** 元素从下方 30px + 透明 → 正常位置 + 不透明 */
export function fadeInUp(el: HTMLElement | string, delay = 0, duration = 0.5) {
  gsap.fromTo(el,
    { opacity: 0, y: 30 },
    { opacity: 1, y: 0, duration, delay, ease: 'power3.out' },
  );
}

/** 卡片列表交错入场 */
export function staggerCards(selector: string, staggerDelay = 0.08, duration = 0.45) {
  gsap.fromTo(selector,
    { opacity: 0, y: 24 },
    { opacity: 1, y: 0, duration, stagger: staggerDelay, ease: 'back.out(1.2)' },
  );
}

/** KPI 卡组从缩放 0.9 → 1，带弹性 */
export function bounceInKpis(selector: string) {
  gsap.fromTo(selector, { scale: 0.9, opacity: 0 }, {
    scale: 1, opacity: 1, duration: 0.6,
    stagger: 0.06, ease: 'back.out(1.6)',
  });
}

/** Hero 标题逐字入场 */
export function heroReveal(selector: string) {
  gsap.fromTo(selector, { y: 60, opacity: 0 }, {
    y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
  });
}

/** 页面标题下方副标题延迟入场 */
export function subtitleReveal(selector: string) {
  gsap.fromTo(selector, { y: 20, opacity: 0 }, {
    y: 0, opacity: 1, duration: 0.6, delay: 0.25, ease: 'power2.out',
  });
}

/** === 悬停效果 === */

/** 卡片悬停：上浮 + 阴影加深 */
export function cardHover(el: HTMLElement) {
  gsap.to(el, { y: -4, boxShadow: '0 12px 30px rgba(0,0,0,0.10)', duration: 0.2, ease: 'power2.out' });
}

/** 卡片取消悬停 */
export function cardUnhover(el: HTMLElement) {
  gsap.to(el, { y: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', duration: 0.2, ease: 'power2.out' });
}

/** === 按钮效果 === */

/** 按钮按下缩放 */
export function buttonPress(el: HTMLElement) {
  gsap.to(el, { scale: 0.96, duration: 0.08, ease: 'power1.in' });
}
export function buttonRelease(el: HTMLElement) {
  gsap.to(el, { scale: 1, duration: 0.15, ease: 'elastic.out(1)' });
}

/** === 数字滚动 === */

/** 从 0 滚动到 target 数字 */
export function countUp(el: HTMLElement, target: number, duration = 1.2) {
  const obj = { val: 0 };
  gsap.to(obj, {
    val: target,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = Math.round(obj.val).toLocaleString();
    },
  });
}

/** === 通知 / 提醒 === */

/** 铃铛图标弹跳 */
export function notificationBounce(el: HTMLElement) {
  gsap.fromTo(el, { scale: 1 }, { scale: 1.3, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.inOut' });
}

/** === Modal / Drawer === */

/** Modal 从缩放 0.95 + 透明 → 1 + 不透明 */
export function modalEnter(el: HTMLElement) {
  gsap.fromTo(el, { scale: 0.95, opacity: 0 }, {
    scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.4)',
  });
}

/** 遮罩层淡入 */
export function overlayFadeIn(el: HTMLElement) {
  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25 });
}

/** === 页面过渡 === */

/** 整页淡入上浮（路由切换时调用） */
export function pageEnter(containerSelector: string) {
  gsap.fromTo(containerSelector, { opacity: 0, y: 20 }, {
    opacity: 1, y: 0, duration: 0.4, ease: 'power3.out',
  });
}

/** === 加载态 === */

/** Skeleton 闪烁 */
export function skeletonPulse(selector: string) {
  gsap.to(selector, { opacity: 0.4, duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
}

/** === 进度条 === */

/** 进度条从 0 → target% */
export function progressFill(el: HTMLElement, targetPercent: number, duration = 1.0) {
  const obj = { w: 0 };
  gsap.to(obj, {
    w: targetPercent,
    duration,
    ease: 'power3.inOut',
    onUpdate: () => { el.style.width = `${obj.w}%`; },
  });
}
