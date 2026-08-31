import React from 'react';
import { Dropdown, Button } from 'antd';
import { Eye, TrendingUp, RefreshCw, Edit3, PauseCircle, PlayCircle, Trash2, MoreHorizontal } from 'lucide-react';

// Verbatim extraction from src/pages/AsinManagerPage.jsx (row actions cell).
const RowActionsCell = ({
  asin,
  isAdmin,
  handleViewAsin,
  handleViewTrends,
  handleIndividualScrape,
  setActiveEditAsin,
  handleToggleAsinStatus,
  handleDeleteAsin,
}) => {
    return (
                        <td style={{
                          ...tdStyle,
                          width: '60px',
                          textAlign: 'center',
                          position: 'sticky',
                          right: 0,
                          background: idx % 2 === 0 ? '#fff' : 'var(--bg-secondary)',
                          zIndex: 6,
                          borderLeft: '1px solid var(--border-light)',
                          padding: '4px'
                        }}>
                          <Dropdown
                            menu={{
                              items: [
                                {
                                  key: 'view',
                                  label: 'View Details',
                                  icon: <Eye size={14} className="text-blue-500" />,
                                  onClick: () => handleViewAsin(asin)
                                },
                                {
                                  key: 'trends',
                                  label: 'View Trends',
                                  icon: <TrendingUp size={14} className="text-indigo-500" />,
                                  onClick: () => handleViewTrends(asin)
                                },
                                {
                                  key: 'sync',
                                  label: 'Sync Marketplace',
                                  icon: <RefreshCw size={14} className="text-emerald-500" />,
                                    onClick: () => handleIndividualScrape(asin._id)
                                },
                                {
                                    key: 'edit',
                                    label: 'Edit ASIN',
                                    icon: <Edit3 size={14} className="text-amber-500" />,
                                    onClick: () => {
                                        setActiveEditAsin(asin);
                                    }
                                },
                                {
                                  key: 'toggle',
                                  label: asin.status === 'Active' ? 'Deactivate' : 'Activate',
                                  icon: asin.status === 'Active' ? <PauseCircle size={14} className="text-zinc-500" /> : <PlayCircle size={14} className="text-emerald-500" />,
                                  onClick: () => handleToggleAsinStatus(asin._id, asin.status)
                                },
                                isAdmin ? { type: 'divider' } : null,
                                isAdmin ? {
                                  key: 'delete',
                                  label: 'Delete ASIN',
                                  icon: <Trash2 size={14} className="text-rose-500" />,
                                  danger: true,
                                  onClick: () => handleDeleteAsin(asin._id)
                                } : null
                              ].filter(Boolean)
                            }}
                            trigger={['click']}
                            placement="bottomRight"
                          >
                            <Button
                              type="text"
                              size="small"
                              icon={<MoreHorizontal size={16} color="var(--text-muted)" />}
                              className="hover-bg-zinc-100 rounded-circle"
                              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            />
                          </Dropdown>
                        </td>
    );
};

export default RowActionsCell;
