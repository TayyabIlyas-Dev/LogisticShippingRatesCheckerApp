// DoubleTriangleSVG.tsx
import React from "react";

type DoubleTriangleSVGProps = {
  className1?: string;
  className2?: string;
};

const AnimatedTriangle: React.FC<DoubleTriangleSVGProps> = ({
  className1,
  className2,
}) => (
  <div className="sm:block  hidden ">
    <svg
      viewBox="0 0 200 200"
      className={className1}
    >
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF5B2E" />
          <stop offset="100%" stopColor="#FFAA88" />
        </linearGradient>
      </defs>
      <path
        d="
      M 50 0 
      L 0 100 
      L 100 100 
      L 50 0 
      M 50 0 
      L 20 90 
      L 80 90 
      L 54 20 
        "
        fill="url(#grad1)"
        fillRule="evenodd"
      />
    </svg>


    <svg
      viewBox="0 0 200 200"
      className={className2}
    >
      <defs>
        <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgba(255, 255, 255 ,0.8)" />
        <stop offset="100%" stopColor="rgba(255, 255, 255 , 0.8)" />
        </linearGradient>
      </defs>
      <path
        d="
          M 50 0 
          L 0 100 
          L 100 100 
          L 50 0 
          M 50 0 
          L 20 90 
          L 80 90 
          L 50 20 
        "
        fill="url(#grad2)"
        fillRule="evenodd"
      />
    </svg>
  </div>
);

export default AnimatedTriangle;
