import { useEffect, useState } from 'react';
import { Button, Card, Input, InputNumber, Select, Tooltip, message } from 'antd';
import { EditOutlined, UndoOutlined } from '@ant-design/icons';
import {
  useEditableFields,
  type EditableFieldDef,
  type EditableFieldOption,
  type EditableFieldType,
  type EditableValue,
  type EditableValues,
} from '@/hooks/useEditableFields';
import './index.css';

// ------------------------------------------------------------------
// 内部：单字段编辑单元（显示 / 编辑 双态）
// 页面级与行级共用，保证交互 100% 一致。
// ------------------------------------------------------------------

interface EditableCellProps {
  field: EditableFieldDef;
  value: EditableValue;
  editing: boolean;
  onStartEdit: () => void;
  onCommit: (next: EditableValue) => void;
  onCancel: () => void;
}

function EditableCell({ field, value, editing, onStartEdit, onCommit, onCancel }: EditableCellProps) {
  const [local, setLocal] = useState<EditableValue>(value);
  // 进入编辑态时，用已保存值初始化草稿
  useEffect(() => {
    if (editing) setLocal(value);
  }, [editing, value]);

  const handleCommit = () => onCommit(local);

  if (!editing) {
    return (
      <button type="button" className="editable-display" onClick={onStartEdit} title="点击即可编辑">
        <FieldDisplay field={field} value={value} />
        <EditOutlined className="editable-pencil" aria-hidden />
      </button>
    );
  }

  if (field.type === 'select') {
    return (
      <Select
        autoFocus
        defaultOpen
        className="editable-input"
        value={String(local)}
        onChange={(next) => onCommit(next)}
        onBlur={onCancel}
        options={(field.options ?? []).map((opt) => ({ value: opt.value, label: opt.label }))}
        placeholder={field.placeholder}
        style={{ width: '100%' }}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <Input.TextArea
        autoFocus
        className="editable-input"
        value={String(local)}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleCommit}
        onPressEnter={(e) => {
          const ke = e as unknown as KeyboardEvent;
          if (ke.ctrlKey || ke.metaKey) {
            e.preventDefault();
            handleCommit();
          }
        }}
        rows={2}
        placeholder={field.placeholder}
        maxLength={500}
      />
    );
  }

  if (field.type === 'number') {
    return (
      <InputNumber
        autoFocus
        className="editable-input"
        value={typeof local === 'number' ? local : Number(local) || 0}
        onChange={(next) => setLocal(typeof next === 'number' ? next : 0)}
        onBlur={handleCommit}
        onPressEnter={handleCommit}
        min={field.min}
        max={field.max}
        placeholder={field.placeholder}
        style={{ width: '100%' }}
      />
    );
  }

  return (
    <Input
      autoFocus
      className="editable-input"
      value={String(local)}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleCommit}
      onPressEnter={handleCommit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          setLocal(value);
          onCancel();
        }
      }}
      placeholder={field.placeholder}
      maxLength={120}
    />
  );
}

function FieldDisplay({ field, value }: { field: EditableFieldDef; value: EditableValue | undefined }) {
  const v = value ?? '';
  if (field.type === 'select') {
    const matched = field.options?.find((opt) => opt.value === String(v));
    return <span className={`editable-display-value ${v === '' ? 'is-empty' : ''}`}>{matched?.label ?? '—'}</span>;
  }
  if (field.type === 'number') {
    return (
      <span className={`editable-display-value ${v === '' ? 'is-empty' : ''}`}>{v === '' ? '—' : String(v)}</span>
    );
  }
  return (
    <span className={`editable-display-value ${v === '' ? 'is-empty' : ''}`}>{v === '' ? '尚未设置' : String(v)}</span>
  );
}

// ------------------------------------------------------------------
// 页面级：可编辑字段卡片（点击即编辑）
// ------------------------------------------------------------------

export interface EditableFieldListProps {
  /** 唯一存储键（已含命名空间），例如 `simulation::tasks::page` */
  storageKey: string;
  /** 字段定义（label / type / options / hint） */
  fields: EditableFieldDef[];
  /** 字段初始值（key→value），与 fields 一一对应 */
  initial: EditableValues;
  /** 卡片标题 */
  title?: string;
  /** 标题角标文案 */
  eyebrow?: string;
  /** 描述文本 */
  description?: string;
  /** 字段保存（值变更）后回调 */
  onSaved?: (values: EditableValues) => void;
}

export function EditableFieldList({
  storageKey,
  fields,
  initial,
  title,
  eyebrow,
  description,
  onSaved,
}: EditableFieldListProps) {
  const { values, setField, reset } = useEditableFields({ storageKey, initial });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const commit = (key: string, next: EditableValue) => {
    const prev = values[key] ?? '';
    setField(key, next);
    setEditingKey(null);
    if (prev !== next) {
      setSavedKey(key);
      window.setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 900);
      onSaved?.({ ...values, [key]: next });
    }
  };

  return (
    <Card
      className="editable-field-list"
      title={
        <div className="editable-card-title">
          {eyebrow && <span className="editable-card-eyebrow">{eyebrow}</span>}
          <span className="editable-card-title-text">{title ?? '可编辑信息'}</span>
        </div>
      }
      extra={
        <Tooltip title="恢复为默认设置">
          <Button
            size="small"
            type="text"
            icon={<UndoOutlined />}
            onClick={() => {
              reset();
              setEditingKey(null);
              message.info('已恢复为默认设置');
            }}
          />
        </Tooltip>
      }
    >
      {description && <p className="editable-card-desc">{description}</p>}
      <div className="editable-body">
        {fields.map((field) => (
          <div
            className={`editable-row editable-row-${field.width ?? 'md'} editable-type-${field.type} ${
              savedKey === field.key ? 'is-saved' : ''
            }`}
            key={field.key}
          >
            <div className="editable-row-label">
              <span>{field.label}</span>
              {field.hint && (
                <Tooltip title={field.hint} placement="topLeft">
                  <span className="editable-row-hint">ⓘ</span>
                </Tooltip>
              )}
            </div>
            <div className="editable-row-control">
              <EditableCell
                field={field}
                value={values[field.key] ?? ''}
                editing={editingKey === field.key}
                onStartEdit={() => setEditingKey(field.key)}
                onCommit={(next) => commit(field.key, next)}
                onCancel={() => setEditingKey(null)}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------
// 行级：单字段点击即编辑（用于表格单元格 / 卡片内嵌）
// 用法：<InlineEditable storageKey="simulation::tasks::row" rowId={row.id} fieldKey="nickname" ... />
// 每个字段独立持久化，互不干扰，刷新后保留。
// ------------------------------------------------------------------

export interface InlineEditableProps {
  /** 行级存储命名空间（不含 rowId / fieldKey），例如 `simulation::tasks::row` */
  storageKey: string;
  /** 行标识（用于隔离同一页面不同行的数据） */
  rowId: string;
  /** 字段键名 */
  fieldKey: string;
  type?: EditableFieldType;
  options?: EditableFieldOption[];
  placeholder?: string;
  /** 未设置时的默认值（同时作为初始值） */
  fallback?: EditableValue;
  /** 无障碍标签（可选） */
  label?: string;
  className?: string;
}

export function InlineEditable({
  storageKey,
  rowId,
  fieldKey,
  type = 'text',
  options,
  placeholder,
  fallback = '',
  label,
  className,
}: InlineEditableProps) {
  const fullKey = `${storageKey}::${rowId}::${fieldKey}`;
  const { values, setField } = useEditableFields({ storageKey: fullKey, initial: { [fieldKey]: fallback } });
  const value = values[fieldKey] ?? fallback;
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const field: EditableFieldDef = { key: fieldKey, label: label ?? fieldKey, type, options, placeholder };

  const commit = (next: EditableValue) => {
    const prev = values[fieldKey] ?? fallback;
    setField(fieldKey, next);
    setEditing(false);
    if (prev !== next) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 900);
    }
  };

  return (
    <span className={`inline-editable ${saved ? 'is-saved' : ''} ${className ?? ''}`}>
      <EditableCell
        field={field}
        value={value}
        editing={editing}
        onStartEdit={() => setEditing(true)}
        onCommit={commit}
        onCancel={() => setEditing(false)}
      />
    </span>
  );
}
