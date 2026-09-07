'use client';

import { Divider } from 'antd';
import { cn } from '@/lib/utils';

export const Separator = ({ 
  className, 
  ...props 
}: React.HTMLAttributes<HTMLHRElement>) => {
  return (
    <hr 
      className="ant-divider"
      {...props}
    />
  );
};

export default Divider;