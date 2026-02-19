import React, { useState } from 'react';
import styled from '@emotion/styled';

const TooltipContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const TooltipBox = styled.div`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  padding: 8px 12px;
  background-color: #1f2937; /* Dark gray/black */
  color: #fff;
  font-size: 12px;
  border-radius: 6px;
  white-space: normal;
  width: max-content;
  max-width: 250px;
  z-index: 1000;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  pointer-events: none;
  text-align: center;
  line-height: 1.4;

  &::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #1f2937 transparent transparent transparent;
  }

  ${({ visible }) => visible && `
    opacity: 1;
    visibility: visible;
  `}
`;

const Tooltip = ({ content, children, style }) => {
    const [visible, setVisible] = useState(false);

    const show = () => setVisible(true);
    const hide = () => setVisible(false);

    return (
        <TooltipContainer
            onMouseEnter={show}
            onMouseLeave={hide}
            style={style}
        >
            {children}
            <TooltipBox visible={visible}>
                {content}
            </TooltipBox>
        </TooltipContainer>
    );
};

export default Tooltip;
