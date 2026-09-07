'use client';

import { Card as AntCard, CardProps as AntCardProps } from 'antd';
import { cn } from '@/lib/utils';

interface CardProps extends AntCardProps {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  header?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const Card = ({ 
  className, 
  title, 
  extra, 
  header, 
  children, 
  style,
  ...props 
}: CardProps) => {
  return (
    <AntCard
      className={cn('ant-card', className)}
      title={title}
      extra={extra}
      style={style}
      {...props}
    >
      {header && (
        <div className="ant-card-head">
          <div className="ant-card-head-wrapper">
            {header}
          </div>
        </div>
      )}
      {children}
    </AntCard>
  );
};

const CardHeader = ({ 
  children, 
  className, 
  style 
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className="ant-card-head" style={style}>
      <div className="ant-card-head-wrapper">{children}</div>
    </div>
  );
};

const CardTitle = ({ 
  children, 
  className, 
  style 
}: React.HTMLAttributes<HTMLHeadingElement>) => {
  return (
    <h3 className="ant-card-head-title" style={style}>
      {children}
    </h3>
  );
};

const CardDescription = ({ 
  children, 
  className, 
  style 
}: React.HTMLAttributes<HTMLParagraphElement>) => {
  return (
    <p className="ant-card-description" style={style}>
      {children}
    </p>
  );
};

const CardContent = ({ 
  children, 
  className, 
  style 
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className="ant-card-body" style={{ padding: 24, ...style }}>
      {children}
    </div>
  );
};

const CardFooter = ({ 
  children, 
  className, 
  style 
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className="ant-card-footer" style={style}>
      {children}
    </div>
  );
};

const Meta = ({ 
  className, 
  style,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className="ant-card-meta" style={style} {...props} />
  );
};

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, Meta };
export default Card;