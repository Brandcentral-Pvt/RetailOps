'use client';

import { Input as AntInput } from 'antd';
import { cn } from '@/lib/utils';
import { SearchOutlined } from '@ant-design/icons';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  showSearchIcon?: boolean;
}

export const Input = ({
  className,
  showSearchIcon,
  prefix,
  suffix,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { 
  showSearchIcon?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}) => {
  return (
    <div className="ant-input-wrapper">
      {showSearchIcon && (
        <span className="ant-input-search-icon">
          <SearchOutlined />
        </span>
      )}
      <input
        className="ant-input"
        {...props}
      />
    </div>
  );
}

export default Input;