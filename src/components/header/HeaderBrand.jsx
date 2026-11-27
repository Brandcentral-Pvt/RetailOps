import React from 'react';
import { Breadcrumb, Skeleton, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useHeader } from '../../contexts/HeaderContext';

export default function HeaderBrand({ loading = false }) {
  const { pageMeta } = useHeader();
  const { breadcrumbs = [], title = 'Workspace' } = pageMeta || {};
  if (loading) return <Skeleton.Input active size="small" style={{ width: 160 }} />;
  const items = breadcrumbs.map((bc, index) => ({
    title: bc.path && index < breadcrumbs.length - 1
      ? <Link to={bc.path}>{bc.label}</Link>
      : <span>{bc.label}</span>,
  }));

  return (
    <div className="ro-header-page" aria-label="Current page">
      {items.length > 0 && <Breadcrumb className="ro-header-breadcrumb" items={items} />}
      <Typography.Text className="ro-header-title" strong title={title}>{title}</Typography.Text>
    </div>
  );
}
