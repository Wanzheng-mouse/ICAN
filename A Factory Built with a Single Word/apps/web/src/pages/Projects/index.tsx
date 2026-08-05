import { useEffect, useRef, useState } from 'react';
import {
  App,
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Tag,
  Upload,
  type UploadProps,
} from 'antd';
import {
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  InboxOutlined,
  TeamOutlined,
  UserAddOutlined,
  FolderOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  deleteProjectFile,
  downloadProjectFile,
  removeProjectMember,
  upsertProjectMember,
  uploadProjectFile,
  useProjectMembers,
  useProjects,
  useProjectWorkspace,
  useUpdateProject,
} from '@/api/modules/projectApi';
import { useAppStore } from '@/stores/useAppStore';
import { getApiErrorMessage } from '@/api/errorMessage';
import './index.css';

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function statusMeta(status: string): { accent: string; iconCls: string; tagCls: string; label: string } {
  if (status === 'active') return { accent: 'card-accent-active', iconCls: 'card-icon-active', tagCls: 'card-tag-active', label: '进行中' };
  if (status === 'draft') return { accent: 'card-accent-draft', iconCls: 'card-icon-draft', tagCls: 'card-tag-draft', label: '草稿' };
  return { accent: 'card-accent-archived', iconCls: 'card-icon-archived', tagCls: 'card-tag-archived', label: '已归档' };
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);
  const setProjectContext = useAppStore((state) => state.setProjectContext);
  const [selectedId, setSelectedId] = useState(routeProjectId ?? '');
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm<{ name: string; requirement: string }>();
  const [memberForm] = Form.useForm<{ identity: string; role: 'operator' | 'viewer' }>();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const saveWorkspaceName = async () => {
    if (!selectedId || !workspace.data) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) { message.warning('项目名称不能为空'); return; }
    if (trimmed === workspace.data.project.name) { setEditingName(false); return; }
    const duplicate = projects.some((p) => p.id !== selectedId && p.name === trimmed);
    if (duplicate) { message.error(`项目名称「${trimmed}」已被占用`); return; }
    try {
      await updateMutation.mutateAsync({ id: selectedId, changes: { name: trimmed } });
      message.success('项目名称已更新');
      setEditingName(false);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存失败');
    }
  };

  useEffect(() => {
    setSelectedId(routeProjectId ?? '');
  }, [routeProjectId]);

  const openWorkspace = (id: string) => {
    setSelectedId(id);
    navigate(`/projects/${id}`);
  };
  const closeWorkspace = () => {
    setSelectedId('');
    navigate('/projects');
  };
  const { data: projects = [], isLoading, isError, refetch } = useProjects();
  const workspace = useProjectWorkspace(selectedId);
  const members = useProjectMembers(selectedId);
  const updateMutation = useUpdateProject();
  const canWrite = user?.role !== 'viewer';

  const openScenario = (projectId: string, scenarioId: string) => {
    setProjectContext({ projectId, scenarioId });
    navigate(`/editor?projectId=${projectId}&scenarioId=${scenarioId}`);
  };

  const handleUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    if (!(file instanceof File) || !selectedId) return;
    setUploading(true);
    try {
      await uploadProjectFile(selectedId, file);
      await queryClient.invalidateQueries({ queryKey: ['project-workspace', selectedId] });
      onSuccess?.({});
      message.success(`${file.name} 已保存到项目`);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('上传失败'));
      message.error(`${file.name} 上传失败，请检查文件格式和后端连接`);
    } finally {
      setUploading(false);
    }
  };

  const archiveProject = async (id: string) => {
    await updateMutation.mutateAsync({ id, changes: { status: 'archived' } });
    if (selectedId === id) closeWorkspace();
    message.success('项目已归档');
  };

  const openProjectEditor = () => {
    const project = workspace.data?.project;
    if (!project) return;
    editForm.setFieldsValue({ name: project.name, requirement: project.requirement });
    setEditOpen(true);
  };

  const saveProjectDetails = async () => {
    if (!selectedId) return;
    try {
      const values = await editForm.validateFields();
      await updateMutation.mutateAsync({ id: selectedId, changes: values });
      setEditOpen(false);
      message.success('项目资料已更新');
    } catch (error) {
      if ((error as { errorFields?: unknown[] }).errorFields) return;
      message.error('项目资料更新失败，请重试');
    }
  };

  const saveProjectMember = async () => {
    if (!selectedId) return;
    try {
      const values = await memberForm.validateFields();
      await upsertProjectMember(selectedId, values);
      memberForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['project-members', selectedId] });
      message.success('项目成员与角色已更新');
    } catch (error) {
      if ((error as { errorFields?: unknown[] }).errorFields) return;
      message.error(getApiErrorMessage(error, '成员更新失败，请确认账号已注册且你是项目所有者'));
    }
  };

  const deleteProjectMember = async (memberId: string) => {
    if (!selectedId) return;
    try {
      await removeProjectMember(selectedId, memberId);
      await queryClient.invalidateQueries({ queryKey: ['project-members', selectedId] });
      message.success('成员已移除');
    } catch (error) {
      message.error(getApiErrorMessage(error, '成员移除失败'));
    }
  };

  const activeProjects = projects.filter((p) => p.status !== 'archived');
  const archivedCount = projects.length - activeProjects.length;

  return (
    <div className="projects-page">
      {/* 顶栏 */}
      <div className="projects-header">
        <div className="projects-header-left">
          <h1>项目中心</h1>
          <p>管理你的所有无人仓项目、场景、仿真与方案进化</p>
        </div>
      </div>

      {/* 统计行 */}
      <div className="projects-stats">
        <div className="stat-card stat-active">
          <div className="stat-accent" />
          <div className="stat-value">{activeProjects.length}</div>
          <div className="stat-label">进行中</div>
          <FolderOpenOutlined className="stat-icon" />
        </div>
        <div className="stat-card stat-archived">
          <div className="stat-accent" />
          <div className="stat-value">{archivedCount}</div>
          <div className="stat-label">已归档</div>
          <InboxOutlined className="stat-icon" />
        </div>
        <div className="stat-card stat-total">
          <div className="stat-accent" />
          <div className="stat-value">{projects.length}</div>
          <div className="stat-label">全部项目</div>
          <FolderOutlined className="stat-icon" />
        </div>
        <div
          className="create-project-area"
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/'); }}
        >
          <div className="create-inner">
            <div className="create-icon"><PlusOutlined /></div>
            <div className="create-text">新建项目</div>
          </div>
        </div>
      </div>

      {/* 错误/加载/空状态 */}
      {isError && <Alert className="projects-error" type="error" showIcon message="项目加载失败" action={<Button onClick={() => void refetch()}>重试</Button>} />}

      {isLoading ? (
        <div className="projects-skeleton-grid">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} active paragraph={{ rows: 3 }} style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 16 }} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="projects-empty">
          <div className="empty-icon"><FolderOpenOutlined /></div>
          <div className="empty-title">还没有项目</div>
          <div className="empty-desc">创建你的第一个无人仓项目，从需求分析开始，快速生成场景与仿真方案。</div>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/')} disabled={!canWrite}>创建第一个项目</Button>
        </div>
      ) : (
        <div className="project-grid">
          {[...activeProjects, ...projects.filter((p) => p.status === 'archived')].map((project) => {
            const meta = statusMeta(project.status);
            return (
              <div key={project.id} className="project-card">
                {/* 色带 */}
                <div className={`card-accent ${meta.accent}`} />

                <div className="project-card-body">
                  {/* 头部 */}
                  <div className="project-card-header">
                    <div className={`card-icon ${meta.iconCls}`}>
                      <FolderOpenOutlined />
                    </div>
                    <div className="card-title-area">
                      <div className="card-name" title={project.name}>{project.name}</div>
                      <span className={`card-tag ${meta.tagCls}`}>{meta.label}</span>
                    </div>
                  </div>

                  {/* 描述 */}
                  <div className="card-desc">{project.requirement || '暂无需求描述'}</div>

                  {/* 底部元信息 */}
                  <div className="card-meta">
                    <span className="card-time"><ClockCircleOutlined style={{ fontSize: 11 }} /> {new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* 操作栏 */}
                <div className="project-card-actions">
                  <button className="action-btn manage-btn" onClick={() => openWorkspace(project.id)}>
                    <FolderOpenOutlined /> 管理
                  </button>
                  {project.status !== 'archived' ? (
                    <Popconfirm key="archive" title="确认归档此项目？" onConfirm={() => void archiveProject(project.id)} disabled={!canWrite}>
                      <button className="action-btn archive-btn" style={{ color: canWrite ? undefined : '#ccc' }}>
                        <InboxOutlined /> 归档
                      </button>
                    </Popconfirm>
                  ) : (
                    <button className="action-btn" style={{ color: '#ccc', cursor: 'default' }}>
                      <InboxOutlined /> 已归档
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 工作区 Modal ── */}
      <Modal title="项目工作区" width={720} open={Boolean(selectedId)} onCancel={closeWorkspace} destroyOnHidden footer={null}>
        {workspace.isLoading ? <Skeleton active /> : workspace.isError || !workspace.data ? (
          <Alert type="error" showIcon message="工作区加载失败" action={<Button onClick={() => void workspace.refetch()}>重试</Button>} />
        ) : (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="项目名称">
                {editingName ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Input
                      ref={nameInputRef as React.Ref<any>}
                      size="small"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onPressEnter={() => void saveWorkspaceName()}
                      onKeyDown={(e) => { if (e.key === 'Escape') { setNameDraft(workspace.data.project.name); setEditingName(false); } }}
                      style={{ width: 200, height: 28, fontSize: 13 }}
                      maxLength={120}
                    />
                    <Button size="small" type="primary" loading={updateMutation.isPending} onClick={() => void saveWorkspaceName()}>保存</Button>
                    <Button size="small" onClick={() => { setNameDraft(workspace.data.project.name); setEditingName(false); }}>取消</Button>
                  </div>
                ) : (
                  <Space>
                    <span style={{ lineHeight: '28px' }}>{workspace.data.project.name}</span>
                    {canWrite && <Button size="small" type="text" icon={<EditOutlined />} onClick={() => { setNameDraft(workspace.data.project.name); setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 50); }} />}
                  </Space>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="需求说明">{workspace.data.project.requirement || '—'}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag>{workspace.data.project.status}</Tag></Descriptions.Item>
            </Descriptions>
            {canWrite && (
              <Button icon={<EditOutlined />} onClick={openProjectEditor}>
                编辑项目资料
              </Button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Card size="small"><span style={{ fontSize: 13, color: '#64748b' }}>场景数量</span><div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{workspace.data.scenarios.length}</div></Card>
              <Card size="small"><span style={{ fontSize: 13, color: '#64748b' }}>资料文件</span><div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{workspace.data.files.length}</div></Card>
            </div>

            <Card title="场景" size="small">
              <List
                dataSource={workspace.data.scenarios}
                locale={{ emptyText: '该项目还没有场景' }}
                renderItem={(scenario) => (
                  <List.Item actions={[<Button key="open" type="link" onClick={() => openScenario(selectedId, scenario.id)}>打开编辑器</Button>]}>
                    <List.Item.Meta title={scenario.name} description={`版本 ${scenario.version} · ${new Date(scenario.updated_at).toLocaleString()}`} />
                  </List.Item>
                )}
              />
            </Card>

            <Card title={<Space><TeamOutlined />项目成员与权限</Space>} size="small">
              {members.isError && <Alert type="error" showIcon message="成员列表加载失败" action={<Button onClick={() => void members.refetch()}>重试</Button>} style={{ marginBottom: 12 }} />}
              <List
                loading={members.isLoading}
                dataSource={members.data ?? []}
                locale={{ emptyText: '暂无协作成员' }}
                renderItem={(member) => (
                  <List.Item actions={member.role !== 'owner' && canWrite ? [
                    <Popconfirm key="remove" title="确认移除该成员？" onConfirm={() => void deleteProjectMember(member.user_id)}>
                      <Button danger type="link">移除</Button>
                    </Popconfirm>,
                  ] : undefined}>
                    <List.Item.Meta title={member.name} description={`${member.login_name} · ${member.email}`} />
                    <Tag color={member.role === 'owner' ? 'gold' : member.role === 'operator' ? 'blue' : 'default'}>
                      {member.role === 'owner' ? '所有者' : member.role === 'operator' ? '可编辑' : '只读'}
                    </Tag>
                  </List.Item>
                )}
              />
              {canWrite && (
                <Form form={memberForm} layout="inline" initialValues={{ role: 'viewer' }} style={{ marginTop: 12, rowGap: 8 }}>
                  <Form.Item name="identity" rules={[{ required: true, whitespace: true, message: '请输入登录名或邮箱' }]} style={{ flex: 1, minWidth: 220 }}>
                    <Input placeholder="已注册用户的登录名或邮箱" />
                  </Form.Item>
                  <Form.Item name="role">
                    <Select style={{ width: 110 }} options={[{ value: 'operator', label: '可编辑' }, { value: 'viewer', label: '只读' }]} />
                  </Form.Item>
                  <Form.Item>
                    <Button icon={<UserAddOutlined />} onClick={() => void saveProjectMember()}>添加/更新</Button>
                  </Form.Item>
                </Form>
              )}
            </Card>

            <Card
              title="项目资料"
              size="small"
              extra={canWrite && <Upload customRequest={handleUpload} showUploadList={false} disabled={uploading} accept=".jpg,.jpeg,.png,.pdf,.dwg,.dxf,.xlsx,.xls,.csv,.json,.yaml,.yml,.txt"><Button size="small" loading={uploading} icon={<CloudUploadOutlined />}>上传</Button></Upload>}
            >
              <List
                dataSource={workspace.data.files}
                locale={{ emptyText: '暂无上传资料' }}
                renderItem={(file) => (
                  <List.Item actions={[
                    <Button key="download" type="text" icon={<DownloadOutlined />} onClick={() => void downloadProjectFile(file)} />,
                    canWrite ? <Popconfirm key="delete" title="删除这个文件？" onConfirm={async () => {
                      await deleteProjectFile(selectedId, file.id);
                      await queryClient.invalidateQueries({ queryKey: ['project-workspace', selectedId] });
                    }}><Button danger type="text" icon={<DeleteOutlined />} /></Popconfirm> : null,
                  ]}>
                    <List.Item.Meta title={file.filename} description={`${file.kind} · ${formatBytes(file.size)}`} />
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        )}
      </Modal>

      {/* 编辑资料 Modal */}
      <Modal
        title="编辑项目资料"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => void saveProjectDetails()}
        confirmLoading={updateMutation.isPending}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, whitespace: true, message: '请输入项目名称' }, { max: 120 }]}>
            <Input maxLength={120} showCount />
          </Form.Item>
          <Form.Item name="requirement" label="需求说明" rules={[{ max: 5000 }]}>
            <Input.TextArea rows={6} maxLength={5000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
