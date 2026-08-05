import { useCallback, useRef, useState } from 'react';

/**
 * 通用编辑字段类型定义。Hook 内部用泛型承载实际值，组件层按 type 渲染不同控件。
 */
export type EditableFieldType = 'text' | 'number' | 'select' | 'textarea';

export interface EditableFieldOption {
  value: string;
  label: string;
}

export interface EditableFieldDef {
  /** 字段键名（与 values 中的 key 对应） */
  key: string;
  /** 中文标签 */
  label: string;
  /** 控件类型 */
  type: EditableFieldType;
  placeholder?: string;
  hint?: string;
  options?: EditableFieldOption[];
  min?: number;
  max?: number;
  /** select/textarea 控件宽度档（影响 grid 排版） */
  width?: 'sm' | 'md' | 'lg' | 'full';
}

export type EditableValue = string | number;
export type EditableValues = Record<string, EditableValue>;

/**
 * useEditableFields —— 点击即编辑（click-to-edit）状态机
 *
 * 设计目标：移除“进入编辑模式 / 保存 / 取消”三段式，改为字段级就地编辑。
 * - values（已保存值）从 localStorage 还原，缺失时回退 initial
 * - setField(key, value)：立刻写回 state + localStorage（无需单独的“保存”动作）
 * - 每个字段是否处于编辑态由组件本地管理，hook 不关心
 * - reset()：清空已保存值，恢复 initial
 *
 * 存储键：`ican.editable::${storageKey}`
 */
export interface UseEditableFieldsOptions {
  /** 存储命名空间（不含 `ican.editable::` 前缀）。例如 `simulation::tasks::page` 或 `simulation::tasks::row::${id}::nickname` */
  storageKey: string;
  /** 字段初始值（key→value） */
  initial: EditableValues;
}

export interface UseEditableFieldsReturn {
  values: EditableValues;
  setField: (key: string, value: EditableValue) => void;
  /** 重置回 initial，不再保留任何已保存值 */
  reset: () => void;
}

function readFromStorage(key: string): EditableValues | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as EditableValues;
    }
    return null;
  } catch {
    return null;
  }
}

function writeToStorage(key: string, value: EditableValues) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / privacy mode errors
  }
}

function removeFromStorage(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function useEditableFields(options: UseEditableFieldsOptions): UseEditableFieldsReturn {
  const { storageKey, initial } = options;
  const fullKey = `ican.editable::${storageKey}`;
  const initialRef = useRef(initial);
  initialRef.current = initial;

  const [values, setValues] = useState<EditableValues>(() => {
    const stored = readFromStorage(fullKey);
    if (!stored) return { ...initialRef.current };
    // 仅保留 initial 中声明的 key，避免历史脏字段污染
    const merged: EditableValues = { ...initialRef.current };
    for (const key of Object.keys(initialRef.current)) {
      if (key in stored) merged[key] = stored[key];
    }
    return merged;
  });

  const setField = useCallback(
    (key: string, value: EditableValue) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        writeToStorage(fullKey, next);
        return next;
      });
    },
    [fullKey],
  );

  const reset = useCallback(() => {
    setValues({ ...initialRef.current });
    removeFromStorage(fullKey);
  }, [fullKey]);

  return { values, setField, reset };
}
