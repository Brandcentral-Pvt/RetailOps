'use client';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = ({ 
  className, 
  required,
  children,
  ...props 
}: LabelProps) => {
  return (
    <label 
      className="ant-form-item-label"
      {...props}
    >
      {children}
      {required && <span className="ant-form-item-required">*</span>}
    </label>
  );
};

export default Label;