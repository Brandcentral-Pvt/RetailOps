import { useState, useEffect, useRef } from 'react';

const useAnimatedCounter = (endValue, duration = 1200) => {
    const [count, setCount] = useState(0);
    const rafRef = useRef(null);

    useEffect(() => {
        const end = parseFloat(endValue) || 0;
        if (end === 0) {
            setCount(0);
            return;
        }

        let start = null;
        const step = (ts) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 4);
            setCount(eased * end);
            if (p < 1) rafRef.current = requestAnimationFrame(step);
            else setCount(end);
        };

        rafRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafRef.current);
    }, [endValue, duration]);

    return count;
};

export default useAnimatedCounter;
