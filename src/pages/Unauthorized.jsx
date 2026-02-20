import React from 'react';
import { Link } from 'react-router-dom';

const Unauthorized = () => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            textAlign: 'center',
            padding: '20px'
        }}>
            <div style={{
                fontSize: '120px',
                fontWeight: 'bold',
                color: '#ff4d4f',
                marginBottom: '20px'
            }}>
                403
            </div>
            <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>Access Denied</h1>
            <p style={{ fontSize: '18px', color: '#666', marginBottom: '30px', maxWidth: '500px' }}>
                Sorry, you do not have permission to access this page. If you believe this is an error, please contact your administrator.
            </p>
            <Link
                to="/"
                style={{
                    padding: '12px 24px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: '600',
                    transition: 'background-color 0.3s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
            >
                Return to Dashboard
            </Link>
        </div>
    );
};

export default Unauthorized;
