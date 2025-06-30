"use client";

import React, { useEffect, useState } from "react";
import Lottie from "lottie-react";
import animationData from "../../../public/animations/loaderAnimation.json";

export default function PageLoader() {
    const [showLoader, setShowLoader] = useState(true);
    const [showText, setShowText] = useState(false);


    useEffect(() => {
        // Hide loader after page load
        const timer = setTimeout(() => {
            setShowLoader(false);
        }, 2000); // Adjust time as needed

        return () => clearTimeout(timer);
    }, []);


    useEffect(() => {
        const timer = setTimeout(() => {
            setShowText(true);
        }, 300); // 0.4 sec

        return () => clearTimeout(timer);
    }, []);
    if (!showLoader) return null;


    return (
        <div className="fixed inset-0  z-50 flex items-center justify-center backdrop-blur-md bg-black/30">
            <div className="w-[23vw] h-[25vh] relative ">
                {/* Ye tumhara text */}

                <div className="z-10">

                    <Lottie animationData={animationData} loop={true} />
                </div>
                <p
                    className={`absolute -bottom-[56%] left-[41%] px-0 py-2 z-50 text-2xl font-bold bg-transparent
        transition-opacity duration-500 hidden xl:block
        ${showText ? "opacity-100" : "opacity-0"}
      `}
                >                    <span className="textColor ">
                        M
                    </span>
                    <span className="text-black">
                        &
                    </span>
                    <span className="text-textColor">
                        P
                    </span>
                </p>
            </div>
        </div>
    );
}
