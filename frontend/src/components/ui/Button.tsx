'use client';

import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'default' | 'dashed' | 'text' | 'link' | 'outline' | 'text';
  size?: 'small' | 'middle' | 'large';
  asChild?: boolean;
}

export const Button = ({
  variant = 'primary',
  size = 'middle',
  className,
  children,
  asChild = false,
  ...props
}: ButtonProps) => {
  if (asChild) {
    return (
      <Slot className={cn(className)} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      className={cn('ant-btn', `ant-btn-${variant}`, size !== 'middle' && `ant-btn-${size}`, className)}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;