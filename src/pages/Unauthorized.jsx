import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

const Unauthorized = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: 'calc(100vh - 64px)',
            textAlign: 'center',
            padding: '20px',
            backgroundColor: 'var(--bg-secondary)'
        }}>
            <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
            }}>
                <ShieldAlert size={40} color="#D32F2F" />
            </div>
            
            <h1 style={{ 
                fontSize: '30px', 
                fontWeight: '800',
                color: 'var(--text-primary)',
                marginBottom: '12px' 
            }}>
                Access Denied
            </h1>
            
            <p style={{ 
                fontSize: 'var(--font-size-lg)', 
                color: 'var(--text-secondary)', 
                marginBottom: '32px', 
                maxWidth: '420px',
                lineHeight: '1.5'
            }}>
                Your current role does not have the required permissions to view this section. 
                Please contact your supervisor if you believe this is a mistake.
            </p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        backgroundColor: 'white',
                        color: 'var(--text-primary)',
                        border: '1px solid #d1d5db',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: 'var(--font-size-base)',
                        transition: 'all 0.2s'
                    }}
                >
                    <ArrowLeft size={16} />
                    Go Back
                </button>
                
                <button
                    onClick={() => navigate('/')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        backgroundColor: '#1976D2',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: 'var(--font-size-base)',
                        transition: 'all 0.2s'
                    }}
                >
                    <Home size={16} />
                    Dashboard
                </button>
            </div>
        </div>
    );
};

export default Unauthorized;
