'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  orientation: 'horizontal' | 'vertical';
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within Tabs');
  }
  return context;
}

const Tabs = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & {
    value: string;
    onValueChange: (value: string) => void;
    defaultValue?: string;
    orientation?: 'horizontal' | 'vertical';
  }
>(({ className, value, onValueChange, children, orientation = 'horizontal', ...props }, ref) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange, orientation }}>
      <div
        ref={ref}
        className={cn('flex', orientation === 'vertical' ? 'flex-col' : 'flex-row', className)}
        data-orientation={orientation}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
});
Tabs.displayName = 'Tabs';

const TabsList = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, children, ...props }, ref) => {
  const { orientation } = useTabsContext();
  return (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TabsList.displayName = 'TabsList';

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  disabled?: boolean;
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<'button'>,
  TabsTriggerProps
>(({ className, value, disabled, children, ...props }, ref) => {
  const { value: currentValue, onValueChange, orientation } = useTabsContext();
  const isActive = value === currentValue;
  
  return (
    <button
      ref={ref}
      data-value={value}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'hover:bg-muted/50 hover:text-foreground',
        className
      )}
      onClick={() => !disabled && onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = 'TabsTrigger';

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
}

const TabsContent = React.forwardRef<
  React.ElementRef<'div'>,
  TabsContentProps
>(({ className, value, forceMount, children, ...props }, ref) => {
  const { value: currentValue } = useTabsContext();
  const isActive = value === currentValue;
  if (!forceMount && !isActive) return null;
  return (
    <div
      ref={ref}
      data-value={value}
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };