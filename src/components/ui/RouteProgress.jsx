import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const PRIMARY = '#1976D2';
const COMPLETE_EVENT = 'route-progress-complete';

export default function RouteProgress() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  const location = useLocation();
  const prevPath = useRef(location.pathname);

  const finish = useCallback(() => {
    clearInterval(timerRef.current);
    setProgress(100);
  }, []);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    setVisible(true);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(timerRef.current);
          return 90;
        }
        const increment = prev < 50 ? 15 : prev < 70 ? 8 : 3;
        return Math.min(prev + increment, 90);
      });
    }, 200);

    return () => clearInterval(timerRef.current);
  }, [location.pathname]);

  useEffect(() => {
    const onComplete = () => finish();
    window.addEventListener(COMPLETE_EVENT, onComplete);
    return () => window.removeEventListener(COMPLETE_EVENT, onComplete);
  }, [finish]);

  useEffect(() => {
    if (progress >= 100) {
      const timeout = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [progress]);

  if (!visible && progress === 0) return null;

  return (
    <>
      {visible && (
        <div
          className="route-progress-bar"
          style={{ transform: `translateX(-${100 - progress}%)` }}
        />
      )}
      <style>{`
        .route-progress-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: ${PRIMARY};
          z-index: 10001;
          transition: transform 0.25s ease;
          box-shadow: 0 0 8px ${PRIMARY}80;
        }
      `}</style>
    </>
  );
}

export function completeProgress() {
  window.dispatchEvent(new Event(COMPLETE_EVENT));
}
