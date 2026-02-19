import { Package, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { calculateLQS, getLQSIssues } from '../utils/lqs';

const ProductDetailsModal = ({ item, isOpen, onClose }) => {
  if (!isOpen || !item) return null;

  const lqsScore = calculateLQS(item);
  const lqsIssues = getLQSIssues(item);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Product Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="h-20 w-20 border border-slate-200 rounded bg-slate-50 flex items-center justify-center overflow-hidden">
                {item.image ? <img className="h-full w-full object-cover" src={item.image} alt="" /> : <Package className="h-8 w-8 text-slate-300" />}
              </div>
              <div>
                <h3 className="font-semibold text-lg text-slate-900">{item.title || item.asin}</h3>
                <p className="text-sm text-slate-500 font-mono">{item.asin}</p>
                {item.brand && <p className="text-sm text-slate-600">Brand: {item.brand}</p>}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <h4 className="font-medium text-slate-900">Basic Information</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-slate-600">Category:</span>
                <span className="text-slate-900">{item.category || 'N/A'}</span>
                <span className="text-slate-600">Size Tier:</span>
                <span className="text-slate-900">{item.stapleLevel}</span>
                <span className="text-slate-600">Price:</span>
                <span className="text-slate-900">₹{item.price || 0}</span>
                <span className="text-slate-600">Weight:</span>
                <span className="text-slate-900">{item.weight || 0}g</span>
                <span className="text-slate-600">Dimensions:</span>
                <span className="text-slate-900">{item.dimensions || 'N/A'}</span>
              </div>
            </div>

            {item.categoryPath && (
              <div>
                <h4 className="font-medium text-slate-900 mb-2">Category Path</h4>
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded">{item.categoryPath}</p>
              </div>
            )}

            {/* LQS Section */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-slate-900">Listing Quality Score</h4>
                <span className={`px-2 py-1 rounded text-sm font-bold ${lqsScore >= 80 ? 'bg-green-100 text-green-700' : lqsScore >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                  {lqsScore}/100
                </span>
              </div>

              {lqsIssues.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>Listing looks great!</span>
                </div>
              ) : (
                <ul className="space-y-1">
                  {lqsIssues.map((issue, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-red-600">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-medium text-slate-900 mb-3">Fee Breakdown</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Referral Fee:</span>
                  <span className="text-slate-900">₹{item.referralFee || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Closing Fee:</span>
                  <span className="text-slate-900">₹{item.closingFee || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Shipping Fee:</span>
                  <span className="text-slate-900">₹{item.shippingFee || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Pick & Pack:</span>
                  <span className="text-slate-900">₹{item.pickAndPackFee || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Storage Fee:</span>
                  <span className="text-slate-900">₹{item.storageFee || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">GST (18%):</span>
                  <span className="text-slate-900">₹{item.tax || 0}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 mt-2">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-900">Total Fees:</span>
                    <span className="text-slate-900">₹{item.totalFees || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-medium text-slate-900 mb-3">Profitability</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Original Net Profit:</span>
                  <span className="text-slate-900">₹{item.netRevenue || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Original Margin:</span>
                  <span className="text-slate-900">{item.marginPercent?.toFixed(2) || 0}%</span>
                </div>
                {item.returnPercent && item.returnPercent > 0 && (
                  <>
                    <div className="border-t border-slate-200 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Return %:</span>
                        <span className="text-slate-900">{item.returnPercent}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Adjusted Net Profit:</span>
                        <span className="text-slate-900">₹{item.adjustedNetRevenue || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Adjusted Margin:</span>
                        <span className="text-slate-900">{item.adjustedMarginPercent?.toFixed(2) || 0}%</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsModal;
