import React from 'react';
import { createPortal } from 'react-dom';

export interface ModalPortalProps
    extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

const ModalPortal: React.FC<ModalPortalProps> = ({
    children,
    ...properties
}) => {
    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <div {...properties}>
            {children}
        </div>,
        document.body
    );
};

export default ModalPortal;
