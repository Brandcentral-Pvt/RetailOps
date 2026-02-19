import React from 'react';

export const Input = ({ 
  label, 
  type = 'text', 
  value, 
  onChange, 
  placeholder, 
  multiline = false, 
  rows = 1, 
  inputClassName = '',
  required = false
}) => {
  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {multiline ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          className={`w-full p-2.5 border border-slate-300 rounded-md bg-white text-sm focus:ring-orange-500 focus:border-orange-500 ${inputClassName}`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className={`w-full p-2.5 border border-slate-300 rounded-md bg-white text-sm focus:ring-orange-500 focus:border-orange-500 ${inputClassName}`}
        />
      )}
    </div>
  );
};
