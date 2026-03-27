import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, X } from 'lucide-react';
import { format, subDays } from 'date-fns';

const DateRangePicker = ({
    startDate,
    endDate,
    onDateChange,
    placeholder = 'Select date range'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dateRange, setDateRange] = useState([
        startDate || null,
        endDate || null
    ]);

    const handleChange = (update) => {
        const [start, end] = update;
        setDateRange([start, end]);
        if (start && end) {
            onDateChange?.(start, end);
            setIsOpen(false);
        }
    };

    const clearDates = (e) => {
        e.stopPropagation();
        setDateRange([null, null]);
        onDateChange?.(null, null);
    };

    const formatDisplayDate = () => {
        const [start, end] = dateRange;
        if (start && end) {
            return `${format(start, 'MMM dd, yyyy')} - ${format(end, 'MMM dd, yyyy')}`;
        }
        if (start) {
            return `${format(start, 'MMM dd, yyyy')} - Select end date`;
        }
        return placeholder;
    };

    return (
        <div className="position-relative">
            <div
                className="d-flex align-items-center gap-2 px-3 py-2 border rounded-3 cursor-pointer"
                style={{
                    backgroundColor: 'var(--color-surface-2, #f8fafc)',
                    borderColor: 'var(--color-border, #e2e8f0)',
                    cursor: 'pointer',
                    minWidth: '200px'
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Calendar size={16} style={{ color: '#64748b' }} />
                <span className="flex-grow-1 smallest fw-medium text-truncate" style={{ color: '#334155' }}>
                    {formatDisplayDate()}
                </span>
                {dateRange[0] && (
                    <X
                        size={14}
                        style={{ color: '#94a3b8' }}
                        onClick={clearDates}
                    />
                )}
            </div>

            {isOpen && (
                <div
                    className="position-absolute bg-white border rounded-3 shadow-lg p-3"
                    style={{
                        zIndex: 1000,
                        top: '100%',
                        marginTop: '4px',
                        left: 0
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <DatePicker
                        selectsRange
                        startDate={dateRange[0]}
                        endDate={dateRange[1]}
                        onChange={handleChange}
                        inline
                        monthsShown={2}
                        minDate={subDays(new Date(), 365)}
                        maxDate={new Date()}
                    />
                    <div className="d-flex justify-content-end gap-2 mt-2 pt-2 border-top">
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => {
                                setDateRange([null, null]);
                                setIsOpen(false);
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setIsOpen(false)}
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;