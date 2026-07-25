import { Button, Result, Space } from 'antd';
import { HomeOutlined, RollbackOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: 'calc(100vh - 150px)', display: 'grid', placeItems: 'center' }}>
      <Result
        status="404"
        title="404"
        subTitle="你访问的页面不存在、已移动，或者当前链接已经失效。"
        extra={<Space><Button icon={<RollbackOutlined />} onClick={() => navigate(-1)}>返回上一页</Button><Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/')}>返回首页</Button></Space>}
      />
    </div>
  );
}

