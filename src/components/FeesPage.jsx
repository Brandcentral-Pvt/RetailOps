import React, { useState, useEffect } from 'react';
import { db } from '../services/db';

const FeesPage = () => {
  const [activeTab, setActiveTab] = useState('referral');
  const [refFees, setRefFees] = useState([]);
  const [closeFees, setCloseFees] = useState([]);
  const [shipFees, setShipFees] = useState([]);
  const [storageFees, setStorageFees] = useState([]);
  const [refundFees, setRefundFees] = useState([]);
  const [categoryMappings, setCategoryMappings] = useState([]);
  const [nodeMaps, setNodeMaps] = useState([]);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [referral, closing, shipping, storage, refund, mappings, nodes] = await Promise.all([
      db.getReferralFees(),
      db.getClosingFees(),
      db.getShippingFees(),
      db.getStorageFees(),
      db.getRefundFees(),
      db.getCategoryMappings(),
      db.getNodeMaps()
    ]);
    setRefFees(referral);
    setCloseFees(closing);
    setShipFees(shipping);
    setStorageFees(storage);
    setRefundFees(refund);
    setCategoryMappings(mappings);
    setNodeMaps(nodes);
  };

  const handleDelete = async (type, id) => {
    if (confirm('Are you sure you want to delete this item?')) {
      switch (type) {
        case 'referral':
          await db.deleteReferralFee(id);
          setRefFees(refFees.filter(f => f.id !== id));
          break;
        case 'closing':
          await db.deleteClosingFee(id);
          setCloseFees(closeFees.filter(f => f.id !== id));
          break;
        case 'shipping':
          await db.deleteShippingFee(id);
          setShipFees(shipFees.filter(f => f.id !== id));
          break;
        case 'storage':
          await db.deleteStorageFee(id);
          setStorageFees(storageFees.filter(f => f.id !== id));
          break;
        case 'refund':
          await db.deleteRefundFee(id);
          setRefundFees(refundFees.filter(f => f.id !== id));
          break;
        case 'mapping':
          await db.deleteCategoryMapping(id);
          setCategoryMappings(categoryMappings.filter(f => f.id !== id));
          break;
        case 'nodemap':
          await db.deleteNodeMap(id);
          setNodeMaps(nodeMaps.filter(f => f.id !== id));
          break;
      }
    }
  };

  const openAddModal = (type) => {
    setModalType(type);
    setEditingItem(null);
    setShowModal(true);
  };

  const openEditModal = (type, item) => {
    setModalType(type);
    setEditingItem(item);
    setShowModal(true);
  };

  const formatPriceRange = (min, max) => {
    if (max === Infinity) return `₹${min}+`;
    return `₹${min}-${max}`;
  };

  const formatWeightRange = (min, max) => {
    if (max === Infinity) return `${min}g+`;
    return `${min}-${max}g`;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'referral':
        return renderReferralFees();
      case 'closing':
        return renderClosingFees();
      case 'shipping':
        return renderShippingFees();
      case 'storage':
        return renderStorageFees();
      case 'refund':
        return renderRefundFees();
      case 'mappings':
        return renderCategoryMappings();
      case 'nodemaps':
        return renderNodeMaps();
      default:
        return renderReferralFees();
    }
  };

  const renderReferralFees = () => (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0"><i className="bi bi-currency-rupee me-2"></i>Referral Fees</h5>
        <button className="btn btn-primary btn-sm" onClick={() => openAddModal('referral')}>
          <i className="bi bi-plus me-1"></i>Add Fee
        </button>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover table-striped mb-0">
            <thead className="table-light">
              <tr>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Node ID</th>
                <th className="px-3 py-2">Tiers</th>
                <th className="px-3 py-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {refFees.map((fee) => (
                <tr key={fee.id}>
                  <td className="px-3 py-2 fw-medium">{fee.category}</td>
                  <td className="px-3 py-2 font-monospace">{fee.nodeId || '-'}</td>
                  <td className="px-3 py-2">
                    {fee.tiers && fee.tiers.map((tier, idx) => (
                      <div key={idx} className="small">
                        {formatPriceRange(tier.minPrice, tier.maxPrice)}: {tier.percentage}%
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <div className="d-flex justify-content-end gap-1">
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => openEditModal('referral', fee)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete('referral', fee.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {refFees.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-3 py-4 text-center text-muted">
                    <i className="bi bi-inbox fs-1"></i>
                    <p className="mt-2">No referral fees configured. Click "Add Fee" to create one.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderClosingFees = () => (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0"><i className="bi bi-tag me-2"></i>Closing Fees</h5>
        <button className="btn btn-primary btn-sm" onClick={() => openAddModal('closing')}>
          <i className="bi bi-plus me-1"></i>Add Fee
        </button>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover table-striped mb-0">
            <thead className="table-light">
              <tr>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Node ID</th>
                <th className="px-3 py-2">Price Range</th>
                <th className="px-3 py-2">Fee (₹ INR)</th>
                <th className="px-3 py-2">Seller Type</th>
                <th className="px-3 py-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {closeFees.map((fee) => (
                <tr key={fee.id}>
                  <td className="px-3 py-2">{fee.category || '-'}</td>
                  <td className="px-3 py-2 font-monospace">{fee.nodeId || '-'}</td>
                  <td className="px-3 py-2">{formatPriceRange(fee.minPrice, fee.maxPrice)}</td>
                  <td className="px-3 py-2 font-monospace">₹ {fee.fee} INR</td>
                  <td className="px-3 py-2">
                    <span className="badge bg-info">{fee.sellerType || 'All'}</span>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <div className="d-flex justify-content-end gap-1">
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => openEditModal('closing', fee)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete('closing', fee.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {closeFees.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-3 py-4 text-center text-muted">
                    <i className="bi bi-inbox fs-1"></i>
                    <p className="mt-2">No closing fees configured. Click "Add Fee" to create one.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderShippingFees = () => (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0"><i className="bi bi-truck me-2"></i>Shipping Fees</h5>
        <button className="btn btn-primary btn-sm" onClick={() => openAddModal('shipping')}>
          <i className="bi bi-plus me-1"></i>Add Fee
        </button>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover table-striped mb-0">
            <thead className="table-light">
              <tr>
                <th className="px-3 py-2">Size Type</th>
                <th className="px-3 py-2">Weight Range (g)</th>
                <th className="px-3 py-2">Fee (₹ INR)</th>
                <th className="px-3 py-2">Pick & Pack (₹ INR)</th>
                <th className="px-3 py-2">Incremental</th>
                <th className="px-3 py-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shipFees.map((fee) => (
                <tr key={fee.id}>
                  <td className="px-3 py-2">
                    <span className={`badge ${fee.sizeType === 'Standard' ? 'bg-success' : fee.sizeType === 'Heavy' ? 'bg-warning' : 'bg-info'}`}>
                      {fee.sizeType}
                    </span>
                  </td>
                  <td className="px-3 py-2">{formatWeightRange(fee.weightMin, fee.weightMax)}</td>
                  <td className="px-3 py-2 font-monospace">₹ {fee.fee} INR</td>
                  <td className="px-3 py-2 font-monospace">₹ {fee.pickAndPackFee || 0} INR</td>
                  <td className="px-3 py-2">
                    {fee.useIncremental ? (
                      <span className="text-success">₹{fee.incrementalFee}/{fee.incrementalStep}g</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <div className="d-flex justify-content-end gap-1">
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => openEditModal('shipping', fee)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete('shipping', fee.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {shipFees.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-3 py-4 text-center text-muted">
                    <i className="bi bi-inbox fs-1"></i>
                    <p className="mt-2">No shipping fees configured. Click "Add Fee" to create one.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderStorageFees = () => (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0"><i className="bi bi-box-seam me-2"></i>Storage Fees</h5>
        <button className="btn btn-primary btn-sm" onClick={() => openAddModal('storage')}>
          <i className="bi bi-plus me-1"></i>Add Fee
        </button>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover table-striped mb-0">
            <thead className="table-light">
              <tr>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Rate (₹/cft INR)</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {storageFees.map((fee) => (
                <tr key={fee.id}>
                  <td className="px-3 py-2">{fee.duration}</td>
                  <td className="px-3 py-2 font-monospace">₹ {fee.rate} INR</td>
                  <td className="px-3 py-2">{fee.description || '-'}</td>
                  <td className="px-3 py-2 text-end">
                    <div className="d-flex justify-content-end gap-1">
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => openEditModal('storage', fee)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete('storage', fee.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {storageFees.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-3 py-4 text-center text-muted">
                    <i className="bi bi-inbox fs-1"></i>
                    <p className="mt-2">No storage fees configured. Click "Add Fee" to create one.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderRefundFees = () => (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0"><i className="bi bi-arrow-counterclockwise me-2"></i>Refund Fees (STEP)</h5>
        <button className="btn btn-primary btn-sm" onClick={() => openAddModal('refund')}>
          <i className="bi bi-plus me-1"></i>Add Fee
        </button>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover table-striped mb-0">
            <thead className="table-light">
              <tr>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Price Range</th>
                <th className="px-3 py-2">Basic (₹ INR)</th>
                <th className="px-3 py-2">Standard (₹ INR)</th>
                <th className="px-3 py-2">Advanced (₹ INR)</th>
                <th className="px-3 py-2">Premium (₹ INR)</th>
                <th className="px-3 py-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {refundFees.map((fee) => (
                <tr key={fee.id}>
                  <td className="px-3 py-2">
                    <span className={`badge ${fee.category === 'General' ? 'bg-secondary' : fee.category === 'Apparel' ? 'bg-primary' : 'bg-success'}`}>
                      {fee.category}
                    </span>
                  </td>
                  <td className="px-3 py-2">{formatPriceRange(fee.minPrice, fee.maxPrice)}</td>
                  <td className="px-3 py-2 font-monospace">₹ {fee.basic} INR</td>
                  <td className="px-3 py-2 font-monospace">₹ {fee.standard} INR</td>
                  <td className="px-3 py-2 font-monospace">₹ {fee.advanced} INR</td>
                  <td className="px-3 py-2 font-monospace">₹ {fee.premium} INR</td>
                  <td className="px-3 py-2 text-end">
                    <div className="d-flex justify-content-end gap-1">
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => openEditModal('refund', fee)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete('refund', fee.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {refundFees.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-3 py-4 text-center text-muted">
                    <i className="bi bi-inbox fs-1"></i>
                    <p className="mt-2">No refund fees configured. Click "Add Fee" to create one.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCategoryMappings = () => (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0"><i className="bi bi-link me-2"></i>Category Mappings</h5>
        <button className="btn btn-primary btn-sm" onClick={() => openAddModal('mapping')}>
          <i className="bi bi-plus me-1"></i>Add Mapping
        </button>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover table-striped mb-0">
            <thead className="table-light">
              <tr>
                <th className="px-3 py-2">Keepa Category</th>
                <th className="px-3 py-2">Fee Category</th>
                <th className="px-3 py-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categoryMappings.map((map) => (
                <tr key={map.id}>
                  <td className="px-3 py-2">{map.keepaCategory}</td>
                  <td className="px-3 py-2">
                    <span className="badge bg-primary">{map.feeCategory}</span>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <div className="d-flex justify-content-end gap-1">
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => openEditModal('mapping', map)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete('mapping', map.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categoryMappings.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-3 py-4 text-center text-muted">
                    <i className="bi bi-inbox fs-1"></i>
                    <p className="mt-2">No category mappings configured.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderNodeMaps = () => (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0"><i className="bi bi-diagram-3 me-2"></i>Node ID Mappings</h5>
        <button className="btn btn-primary btn-sm" onClick={() => openAddModal('nodemap')}>
          <i className="bi bi-plus me-1"></i>Add Node Map
        </button>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover table-striped mb-0">
            <thead className="table-light">
              <tr>
                <th className="px-3 py-2">Node ID</th>
                <th className="px-3 py-2">Fee Category Name</th>
                <th className="px-3 py-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {nodeMaps.map((map) => (
                <tr key={map.id}>
                  <td className="px-3 py-2 font-monospace">{map.nodeId}</td>
                  <td className="px-3 py-2">
                    <span className="badge bg-info">{map.feeCategoryName}</span>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <div className="d-flex justify-content-end gap-1">
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => openEditModal('nodemap', map)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete('nodemap', map.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {nodeMaps.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-3 py-4 text-center text-muted">
                    <i className="bi bi-inbox fs-1"></i>
                    <p className="mt-2">No node mappings configured.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Tab Navigation */}
      <div className="mb-4">
        <ul className="nav nav-tabs">
          {[
            { id: 'referral', label: 'Referral', icon: 'bi-currency-dollar' },
            { id: 'closing', label: 'Closing', icon: 'bi-tag' },
            { id: 'shipping', label: 'Shipping', icon: 'bi-truck' },
            { id: 'storage', label: 'Storage', icon: 'bi-box-seam' },
            { id: 'refund', label: 'Refund (STEP)', icon: 'bi-arrow-counterclockwise' },
            { id: 'mappings', label: 'Categories', icon: 'bi-link' },
            { id: 'nodemaps', label: 'Node Maps', icon: 'bi-diagram-3' }
          ].map((tabItem) => (
            <li className="nav-item" key={tabItem.id}>
              <button
                className={`nav-link ${activeTab === tabItem.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tabItem.id)}
              >
                <i className={`${tabItem.icon} me-1`}></i>
                {tabItem.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {renderTabContent()}
      </div>

      {/* Fee Modal */}
      {showModal && (
        <FeeModal
          type={modalType}
          item={editingItem}
          onClose={() => setShowModal(false)}
          onSave={(data) => {
            setShowModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

// Fee Modal Component
const FeeModal = ({ type, item, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    category: '',
    nodeId: '',
    minPrice: 0,
    maxPrice: Infinity,
    fee: 0,
    percentage: 0,
    tiers: [],
    sizeType: 'Standard',
    weightMin: 0,
    weightMax: 1000,
    pickAndPackFee: 0,
    useIncremental: false,
    incrementalFee: 0,
    incrementalStep: 500,
    duration: 'Monthly',
    rate: 45,
    description: '',
    sellerType: 'FC',
    basic: 0,
    standard: 0,
    advanced: 0,
    premium: 0,
    keepaCategory: '',
    feeCategoryName: '',
    tierMinPrice: 0,
    tierMaxPrice: 500,
    tierPercentage: 0
  });

  useEffect(() => {
    if (item) {
      setFormData({ ...formData, ...item });
    }
  }, [item]);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      switch (type) {
        case 'referral':
          const referralData = {
            category: formData.category,
            nodeId: formData.nodeId,
            tiers: formData.tiers.length > 0 ? formData.tiers : [{
              minPrice: formData.tierMinPrice,
              maxPrice: formData.tierMaxPrice,
              percentage: formData.tierPercentage
            }]
          };
          if (item) {
            // Update existing - would need API call
            alert('Edit functionality would update existing fee');
          } else {
            await db.saveReferralFee(referralData);
          }
          break;
        case 'closing':
          const closingData = {
            category: formData.category,
            nodeId: formData.nodeId,
            minPrice: formData.minPrice,
            maxPrice: formData.maxPrice === '' ? Infinity : Number(formData.maxPrice),
            fee: Number(formData.fee),
            sellerType: formData.sellerType
          };
          await db.saveClosingFee(closingData);
          break;
        case 'shipping':
          const shippingData = {
            sizeType: formData.sizeType,
            weightMin: Number(formData.weightMin),
            weightMax: Number(formData.weightMax),
            fee: Number(formData.fee),
            pickAndPackFee: Number(formData.pickAndPackFee),
            useIncremental: formData.useIncremental,
            incrementalFee: Number(formData.incrementalFee),
            incrementalStep: Number(formData.incrementalStep)
          };
          await db.saveShippingFee(shippingData);
          break;
        case 'storage':
          const storageData = {
            duration: formData.duration,
            rate: Number(formData.rate),
            description: formData.description
          };
          await db.saveStorageFee(storageData);
          break;
        case 'refund':
          const refundData = {
            category: formData.category || 'General',
            minPrice: Number(formData.minPrice),
            maxPrice: formData.maxPrice === '' ? Infinity : Number(formData.maxPrice),
            basic: Number(formData.basic),
            standard: Number(formData.standard),
            advanced: Number(formData.advanced),
            premium: Number(formData.premium)
          };
          await db.saveRefundFee(refundData);
          break;
        case 'mapping':
          const mappingData = {
            keepaCategory: formData.keepaCategory,
            feeCategory: formData.category
          };
          await db.saveCategoryMapping(mappingData);
          break;
        case 'nodemap':
          const nodeMapData = {
            nodeId: formData.nodeId,
            feeCategoryName: formData.feeCategoryName
          };
          await db.saveNodeMap(nodeMapData);
          break;
      }
      onSave();
    } catch (error) {
      console.error('Error saving fee:', error);
      alert('Failed to save fee');
    }
  };

  const addTier = () => {
    setFormData({
      ...formData,
      tiers: [...formData.tiers, {
        minPrice: formData.tierMinPrice,
        maxPrice: formData.tierMaxPrice,
        percentage: formData.tierPercentage
      }]
    });
  };

  const removeTier = (index) => {
    const newTiers = formData.tiers.filter((_, i) => i !== index);
    setFormData({ ...formData, tiers: newTiers });
  };

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {item ? 'Edit' : 'Add'} {type.charAt(0).toUpperCase() + type.slice(1)} Fee
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {type === 'referral' && (
                <>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Category Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.category}
                        onChange={(e) => handleChange('category', e.target.value)}
                        placeholder="e.g., Electronics"
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Node ID (Optional)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.nodeId}
                        onChange={(e) => handleChange('nodeId', e.target.value)}
                        placeholder="Amazon Node ID"
                      />
                    </div>
                  </div>
                  <hr />
                  <h6>Price Tiers</h6>
                  {formData.tiers.map((tier, index) => (
                    <div key={index} className="row g-2 mb-2 align-items-center">
                      <div className="col-auto">
                        <span className="badge bg-secondary">₹{tier.minPrice} - ₹{tier.maxPrice === Infinity ? '∞' : tier.maxPrice}</span>
                      </div>
                      <div className="col-auto">
                        <span className="badge bg-primary">{tier.percentage}%</span>
                      </div>
                      <div className="col-auto">
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeTier(index)}>
                          <i className="bi bi-x"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="row g-2">
                    <div className="col-md-3">
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        placeholder="Min Price"
                        value={formData.tierMinPrice}
                        onChange={(e) => handleChange('tierMinPrice', Number(e.target.value))}
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        placeholder="Max Price"
                        value={formData.tierMaxPrice}
                        onChange={(e) => handleChange('tierMaxPrice', e.target.value === '' ? Infinity : Number(e.target.value))}
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        placeholder="Percentage"
                        step="0.1"
                        value={formData.tierPercentage}
                        onChange={(e) => handleChange('tierPercentage', Number(e.target.value))}
                      />
                    </div>
                    <div className="col-md-3">
                      <button type="button" className="btn btn-sm btn-primary w-100" onClick={addTier}>
                        <i className="bi bi-plus me-1"></i>Add Tier
                      </button>
                    </div>
                  </div>
                </>
              )}

              {type === 'closing' && (
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Category (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.category}
                      onChange={(e) => handleChange('category', e.target.value)}
                      placeholder="e.g., Books"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Node ID (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.nodeId}
                      onChange={(e) => handleChange('nodeId', e.target.value)}
                      placeholder="Amazon Node ID"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Min Price (₹)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.minPrice}
                      onChange={(e) => handleChange('minPrice', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Max Price (₹)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.maxPrice === Infinity ? '' : formData.maxPrice}
                      onChange={(e) => handleChange('maxPrice', e.target.value === '' ? Infinity : Number(e.target.value))}
                      placeholder="Leave empty for ∞"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Fee (₹ INR)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.fee}
                      onChange={(e) => handleChange('fee', Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Seller Type</label>
                    <select
                      className="form-select"
                      value={formData.sellerType}
                      onChange={(e) => handleChange('sellerType', e.target.value)}
                    >
                      <option value="FC">FC (Fulfilled by Amazon)</option>
                      <option value="SF">SF</option>
                      <option value="ES">ES</option>
                      <option value="MFN">MFN</option>
                    </select>
                  </div>
                </div>
              )}

              {type === 'shipping' && (
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Size Type</label>
                    <select
                      className="form-select"
                      value={formData.sizeType}
                      onChange={(e) => handleChange('sizeType', e.target.value)}
                    >
                      <option value="Standard">Standard Size</option>
                      <option value="Heavy">Heavy & Bulky</option>
                      <option value="Oversize">Oversize</option>
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Min Weight (g)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.weightMin}
                      onChange={(e) => handleChange('weightMin', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Max Weight (g)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.weightMax}
                      onChange={(e) => handleChange('weightMax', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Fee (₹ INR)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.fee}
                      onChange={(e) => handleChange('fee', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Pick & Pack (₹ INR)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.pickAndPackFee}
                      onChange={(e) => handleChange('pickAndPackFee', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-12">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="useIncremental"
                        checked={formData.useIncremental}
                        onChange={(e) => handleChange('useIncremental', e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="useIncremental">
                        Use Incremental Weight Pricing
                      </label>
                    </div>
                  </div>
                  {formData.useIncremental && (
                    <div className="col-md-6">
                      <label className="form-label">Incremental Fee (₹)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.incrementalFee}
                        onChange={(e) => handleChange('incrementalFee', Number(e.target.value))}
                      />
                    </div>
                  )}
                  {formData.useIncremental && (
                    <div className="col-md-6">
                      <label className="form-label">Incremental Step (g)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.incrementalStep}
                        onChange={(e) => handleChange('incrementalStep', Number(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              )}

              {type === 'storage' && (
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Duration</label>
                    <select
                      className="form-select"
                      value={formData.duration}
                      onChange={(e) => handleChange('duration', e.target.value)}
                    >
                      <option value="Sep-Jan">Sep-Jan (Peak)</option>
                      <option value="Feb-Aug">Feb-Aug (Standard)</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Rate (₹ per cft)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.rate}
                      onChange={(e) => handleChange('rate', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Description</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {type === 'refund' && (
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={formData.category}
                      onChange={(e) => handleChange('category', e.target.value)}
                    >
                      <option value="General">General</option>
                      <option value="Apparel">Apparel</option>
                      <option value="Shoes">Shoes</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Min Price (₹)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.minPrice}
                      onChange={(e) => handleChange('minPrice', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Max Price (₹)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.maxPrice === Infinity ? '' : formData.maxPrice}
                      onChange={(e) => handleChange('maxPrice', e.target.value === '' ? Infinity : Number(e.target.value))}
                      placeholder="Leave empty for ∞"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Basic (₹ INR)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.basic}
                      onChange={(e) => handleChange('basic', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Standard (₹ INR)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.standard}
                      onChange={(e) => handleChange('standard', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Advanced (₹ INR)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.advanced}
                      onChange={(e) => handleChange('advanced', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Premium (₹ INR)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.premium}
                      onChange={(e) => handleChange('premium', Number(e.target.value))}
                    />
                  </div>
                </div>
              )}

              {type === 'mapping' && (
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Keepa Category Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.keepaCategory}
                      onChange={(e) => handleChange('keepaCategory', e.target.value)}
                      placeholder="e.g., Electronics"
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Fee Category Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.category}
                      onChange={(e) => handleChange('category', e.target.value)}
                      placeholder="e.g., Electronics"
                      required
                    />
                  </div>
                </div>
              )}

              {type === 'nodemap' && (
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Amazon Node ID</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.nodeId}
                      onChange={(e) => handleChange('nodeId', e.target.value)}
                      placeholder="e.g., 1355017031"
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Fee Category Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.feeCategoryName}
                      onChange={(e) => handleChange('feeCategoryName', e.target.value)}
                      placeholder="e.g., Electronics"
                      required
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                <i className="bi bi-check me-1"></i>
                {item ? 'Update' : 'Add'} {type} Fee
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FeesPage;
