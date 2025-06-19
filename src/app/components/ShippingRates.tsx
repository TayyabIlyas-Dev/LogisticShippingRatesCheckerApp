'use client'

import { useEffect, useState } from 'react';
import { ChevronDown } from "lucide-react";
import { LuPackage } from 'react-icons/lu';
import { IoDocumentsOutline } from 'react-icons/io5';
import { RxReload } from 'react-icons/rx';
import { docsData, pkgData, discountData, fetchShippingRates } from '../data/shippingRates';

export default function ShippingRates() {
    const [active, setActive] = useState<'docs' | 'pkg'>('docs');
    const [selectedCountry, setSelectedCountry] = useState('UAE');
    const [selectedWeight, setSelectedWeight] = useState(0.5);
    const [rateData, setRateData] = useState<{ original: number; discounted: number; discountDollar: number }>({ original: 0, discounted: 0, discountDollar: 0 });
    const [rate, setRate] = useState<string | null>(null); // default = null
    const selectedCrypto = 'USD';





    // fetch daily dollar rate 
    useEffect(() => {
        async function fetchRate() {
            try {
                const res = await fetch('/api/dollar-rate');
                const data = await res.json();
                if (data?.rate) {
                    setRate(data.rate);
                }
            } catch (err) {
                console.error('Error fetching rate:', err);
            }
        }

        fetchRate();
    }, []);

    // 🔁 Utility function to update rateData
    function updateRateData() {
        const key = `${selectedCountry}_${selectedWeight}`;
        const data = active === 'docs' ? docsData[key] : pkgData[key];

        if (data) {
            setRateData({
                original: data.original,
                discounted: data.discounted,
                discountDollar: data.original - data.discounted,
            });
        } else {
            setRateData({
                original: 0,
                discounted: 0,
                discountDollar: 0,
            });
        }
    }

    // ✅ Fetch shipping data once on mount
    useEffect(() => {
        async function loadRates() {
            await fetchShippingRates(); // This populates docsData and pkgData
        }

        loadRates();
    }, []);

    // ✅ Update rateData whenever inputs OR shipping data change
    useEffect(() => {
        updateRateData();
    }, [selectedCountry, selectedWeight, active, docsData, pkgData]);



    // ⬆️ Top of your component
    const [countries, setCountries] = useState<string[]>([]);
    const [weights, setWeights] = useState<number[]>([]);


    // ✅ Fetch shipping data & dropdown values
    useEffect(() => {
        async function loadRates() {
            const { countries, weights } = await fetchShippingRates(); // This populates docsData and pkgData
            setCountries(countries);
            setWeights(weights);
        }

        loadRates();
    }, []);

    return (
    //     <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#e8edf5] to-[#e6ebf3] px-4 py-10">
    //         <div className="w-full max-w-xl flex items-center justify-center flex-col relative ">
    //             <h1 className="text-2xl md:text-3xl font-semibold text-center leading-[1] mb-8 text-black tracking-tight uppercase">Shipping Rates</h1>

    //             {/* Top Controls */}
    //             <div className='w-full px-6 pr-8'>
    //                 <div className='flex my-1  items-center justify-around w-full rounded-3xl'>

    //                     <div className="flex items-center justify-center w-[324px] bg-white px-4 py-2.5 rounded-t-3xl rounded-bl-3xl shadow-md  mb-0">
    //                         <div className="flex items-center  gap-2">
    //                             {/* <select className="px-2 py-1.5 border border-gray-300 rounded-full text-sm focus:outline-none">
    //         <option>Select Country</option>
    //     </select> */}
    //                             <div >

    //                                 <span className='text-xs text-center'>
    //                                     <strong>Country : </strong>
    //                                 </span>
    //                                 <select
    //                                     value={selectedCountry}
    //                                     onChange={(e) => setSelectedCountry(e.target.value)}
    //                                     className="px-2.5 py-1.5 border border-gray-300 rounded-full text-xs focus:outline-none"
    //                                 >
    //                                     {countries.map((country) => (
    //                                         <option key={country} value={country}>
    //                                             {country}
    //                                         </option>
    //                                     ))}
    //                                 </select>
    //                             </div>
    //                             <div>

    //                                 <span className='text-sm pl-2 text-center'>
    //                                     <strong>Kg : </strong>
    //                                 </span>
    //                                 <select
    //                                     value={selectedWeight}
    //                                     onChange={(e) => setSelectedWeight(parseFloat(e.target.value))}
    //                                     className="px-2.5 py-1.5 border border-gray-300 rounded-full text-xs focus:outline-none"
    //                                 >
    //                                     {weights.map((w) => (
    //                                         <option key={w} value={w}>
    //                                             {w}
    //                                         </option>
    //                                     ))}
    //                                 </select>

    //                             </div>



    //                         </div>

    //                     </div>
    //                     <div className="flex items-center gap-3 ">
    //                         {/* Selected Label */}
    //                         {/* <span className="text- font-medium text-gray-600">
    //     {active === 'docs' ? 'Selected : Docs' : 'Selected : PKG'}
    // </span> */}

    //                         {/* Toggle Buttons */}
    //                         <div className="inline-flex items-center bg-[#f2f4f9] p-1 rounded-full border gap-1 border-gray-300 text-xs font-medium">
    //                             {/* Docs Button */}
    //                             <button
    //                                 onClick={() => setActive('docs')}
    //                                 className={`px-3 py-1.5 rounded-full transition-all duration-300 ${active === 'docs'
    //                                     ? 'bg-gray-300 text-black shadow-sm'
    //                                     : 'text-gray-500 hover:bg-gray-200'
    //                                     }`}
    //                             >
    //                                 Docs
    //                             </button>

    //                             {/* PKG Button */}
    //                             <button
    //                                 onClick={() => setActive('pkg')}
    //                                 className={`px-3 py-1.5 rounded-full transition-all duration-300 ${active === 'pkg'
    //                                     ? 'bg-orange-500 text-white shadow-sm'
    //                                     : 'text-gray-500 hover:bg-orange-300'
    //                                     }`}
    //                             >
    //                                 PKG
    //                             </button>

    //                             {/* Refresh Icon */}
    //                         </div>
    //                     </div>
    //                 </div>
    //             </div>

    //             {/* Main Exchange Box */}
    //             <div className="bg-white p-7 rounded-[35px] h-[180px] w-[500px] shadow-xl space-y-2 relative mb-1">
    //                 <div className='w-[50%] '>
    //                     <p className="text-base py-1 text-black underline">Rates In Dollar $</p>
    //                     <div className="text-4xl border-b-2 font-geist border-b-gray-400 font-bold textColor tracking-tight">
    //                         {rateData.original.toFixed(2)}


    //                     </div>
    //                     <p className="text-2xl pt-3 text-black">In Rs :
    //                         <span className="textColor font-semibold pl-1">
    //                             {rate ? (rateData.original * parseFloat(rate)).toFixed(2) : 'Loading...'}

    //                         </span>
    //                     </p>
    //                 </div>


    //                 <div className="absolute top-[54%] right-6 flex items-center font-semibold text-xl gap-2-semibold text-black">
    //                     <span className='textColor'>
    //                         Dollar Rate : <span className='text-black'> Rs {rate !== null ? Math.round(parseFloat(rate)) : 'N/A '}</span>

    //                     </span>                    </div>

    //                 <div className="absolute top-6 right-6 flex items-center gap-2">
    //                     <div className="text-left leading-none">
    //                         <div className="text-base font-semibold underline inline-flex items-center gap-1 ">
    //                             <ChevronDown className="w-3 h-3" />
    //                             {active === 'docs' ? 'DOCs' : 'PKG'}
    //                         </div>
    //                         <div className="text-xs text-gray-500 capitalize underline pl-2">{selectedCountry}</div>
    //                     </div>
    //                     <div className="w-10 h-10 rounded-[10px] border-2 py-1 border-gray-500 flex items-center justify-center">
    //                         {active === 'docs' ? (
    //                             <IoDocumentsOutline className="text-black  w-5 h-5" />
    //                         ) : (
    //                             <LuPackage className="text-black  w-5 h-5" />
    //                         )}



    //                     </div>
    //                 </div>
    //             </div>
    //             <div className="relative w-[500px] my-0">
    //                 {/* Horizontal Line */}
    //                 {/* <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-300 z-0" /> */}

    //                 {/* Center Circle */}
    //                 <div className="absolute left-1/2 -translate-x-1/2 -top-5 z-10">
    //                     <div className="w-10 h-10 rounded-full bg-white border border-gray-300 flex items-center justify-center  shadow-sm"
    //                         onClick={() => window.location.reload()}

    //                     >
    //                         <span className="text-gray-700 font-semibold   hover:text-[#ff6b35] transition-transform duration-1000 hover:rotate-[750deg] transform-gpu">

    //                             <RxReload className="w-5 h-5" />
    //                         </span>
    //                     </div>
    //                 </div>
    //             </div>



    //             {/* Discounted Rates Box */}
    //             <div className="bg-white px-7 pt-7 pb-2  h-[280px] w-[500px] rounded-[35px] shadow-xl space-y-1 relative">
    //                 <div className='w-[50%]'>
    //                     <p className="text-xl pb-2 font-semibold textColor">Discounted Rates</p>
    //                     <p className="text-base py-1 text-black   underline">Rates In Dollar $</p>

    //                     <div className="text-4xl font-bold textColor tracking-tight border-b-2 border-gray-400">
    //                         {rateData.discounted.toFixed(2)}

    //                     </div>

    //                 </div>

    //                 <div className=" flex items-center justify-between font-semibold text-xl gap-2 relative pt-2 text-black">
    //                     <div>

    //                         <p className="text-2xl  font-normal text-black">In Rs :
    //                             <span className="textColor font-semibold pl-1">
    //                                 {(rateData.discounted * Number(rate)).toFixed(2)}
    //                             </span>
    //                         </p>
    //                     </div>
    //                     <div className="absolute -top-8 right-2 flex flex-col justify-center text-left gap-0">
    //                         <p className="text-lg border-b-2 border-gray-400 font-semibold">Save  $ : <span className='textColor pl-1'> {rateData.discountDollar.toFixed(2)}</span> </p>

    //                         <p className="text-lg  font-semibold">Save Rs : <span className='textColor pl-1'>
    //                             {(rateData.discountDollar * Number(rate)).toFixed(2)}
    //                         </span> </p>
    //                     </div>
    //                 </div>
    //                 <div className="absolute top-6 right-6 flex items-center gap-2">
    //                     <div className="text-left leading-none">
    //                         <div className="text-base font-semibold underline inline-flex items-center gap-1 ">
    //                             <ChevronDown className="w-3 h-3" />
    //                             {active === 'docs' ? 'DOCs' : 'PKG'}
    //                         </div>
    //                         <div className="text-xs text-gray-600 capitalize underline pl-2">{selectedCountry}</div>
    //                     </div>
    //                     <div className="w-10 h-10 rounded-[10px] border-2 py-1 border-gray-500 flex items-center justify-center">
    //                         {active === 'docs' ? (
    //                             <IoDocumentsOutline className="text-black  w-5 h-5" />
    //                         ) : (
    //                             <LuPackage className="text-black  w-5 h-5" />
    //                         )}



    //                     </div>
    //                 </div>
    //                 <div className='flex  items-center justify-center px-2 py-3 '>

    //                     <button className="px-4 mt-4 py-3 bg-[#ff6b35] shadow-lg shadow-[#ff6b358e] hover:shadow-[#59595c] text-white rounded-lg font-semibold text-sm  hover:bg-[#59595c] duration-500 transition">
    //                         Exchange Now
    //                     </button>
    //                 </div>

    //             </div>
    //         </div>
    //     </div>


    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#e8edf5] to-[#e6ebf3] px-4 py-10">
  <div className="w-full max-w-xl flex items-center justify-center flex-col relative">
    <h1 className="text-2xl md:text-3xl font-semibold text-center leading-[1] mb-8 text-black tracking-tight uppercase">Shipping Rates</h1>

      {/* Top Controls */}
      <div className='w-full pl-16 pr-14'>
                    <div className='flex my-1 flex-col sm:flex-row gap-4 items-center justify-around w-full rounded-3xl'>

                        <div className="flex items-center justify-center w-[324px] bg-white px-4 py-2.5 rounded-3xl  shadow-md  mb-0">
                            <div className="flex items-center  gap-2">
                                {/* <select className="px-2 py-1.5 border border-gray-300 rounded-full text-sm focus:outline-none">
            <option>Select Country</option>
        </select> */}
                                <div >

                                    <span className='text-xs text-center'>
                                        <strong>Country : </strong>
                                    </span>
                                    <select
                                        value={selectedCountry}
                                        onChange={(e) => setSelectedCountry(e.target.value)}
                                        className="px-2.5 py-1.5 border border-gray-300 rounded-full text-xs focus:outline-none"
                                    >
                                        {countries.map((country) => (
                                            <option key={country} value={country}>
                                                {country}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>

                                    <span className='text-sm pl-2 text-center'>
                                        <strong>Kg : </strong>
                                    </span>
                                    <select
                                        value={selectedWeight}
                                        onChange={(e) => setSelectedWeight(parseFloat(e.target.value))}
                                        className="px-2.5 py-1.5 border border-gray-300 rounded-full text-xs focus:outline-none"
                                    >
                                        {weights.map((w) => (
                                            <option key={w} value={w}>
                                                {w}
                                            </option>
                                        ))}
                                    </select>

                                </div>



                            </div>

                        </div>
                        <div className="flex items-center gap-3 ">
                            {/* Selected Label */}
                            {/* <span className="text- font-medium text-gray-600">
        {active === 'docs' ? 'Selected : Docs' : 'Selected : PKG'}
    </span> */}

                            {/* Toggle Buttons */}
                            <div className="inline-flex items-center bg-[#f2f4f9] p-1 rounded-full border gap-1 border-gray-300 text-xs font-medium">
                                {/* Docs Button */}
                                <button
                                    onClick={() => setActive('docs')}
                                    className={`px-3 py-1.5 rounded-full transition-all duration-300 ${active === 'docs'
                                        ? 'bg-gray-300 text-black shadow-sm'
                                        : 'text-gray-500 hover:bg-gray-200'
                                        }`}
                                >
                                    Docs
                                </button>

                                {/* PKG Button */}
                                <button
                                    onClick={() => setActive('pkg')}
                                    className={`px-3 py-1.5 rounded-full transition-all duration-300 ${active === 'pkg'
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:bg-orange-300'
                                        }`}
                                >
                                    PKG
                                </button>

                                {/* Refresh Icon */}
                            </div>
                        </div>
                    </div>
                </div>

    {/* Main Exchange Box */}
    <div className="bg-white p-6 rounded-[30px] mt-1 w-full max-w-md shadow-xl space-y-2 relative">
      <div className="w-full">
        <p className="text-base py-1 text-black underline">Rates In Dollar $</p>
        <div className="text-4xl border-b-2 font-geist border-b-gray-400 font-bold textColor tracking-tight">
          {rateData.original.toFixed(2)}
        </div>
        <p className="text-2xl pt-3 text-black">In Rs :
          <span className="textColor font-semibold pl-1">
            {rate ? (rateData.original * parseFloat(rate)).toFixed(2) : 'Loading...'}
          </span>
        </p>
      </div>

      <div className="absolute top-[54%] right-4 text-sm md:text-sm font-semibold pr-2">
        Dollar Rate : <span className="textColor">Rs {rate !== null ? Math.round(parseFloat(rate)) : 'N/A '}</span>
      </div>

      <div className="absolute top-6 right-4 flex items-center justify-center gap-2">
        <div className="text-left leading-none">
          <div className="text-base font-semibold underline inline-flex items-center gap-1">
            <ChevronDown className="w-3 h-3" />
            {active === 'docs' ? 'DOCs' : 'PKG'}
          </div>
          <div className="text-xs text-gray-500 capitalize underline pl-4">{selectedCountry}</div>
        </div>
        <div className="w-10 h-10 rounded-[10px] border-2 py-1 border-gray-500 flex items-center justify-center">
          {active === 'docs' ? <IoDocumentsOutline className="text-black w-5 h-5" /> : <LuPackage className="text-black w-5 h-5" />}
        </div>
      </div>
    </div>

    <div className="relative w-full max-w-md my-1">
      <div className="absolute left-1/2 -translate-x-1/2 -top-5 z-10">
        <div
          className="w-10 h-10 rounded-full bg-white border border-gray-300 flex items-center justify-center shadow-sm cursor-pointer"
          onClick={() => window.location.reload()}
        >
          <span className="text-gray-700 font-semibold hover:text-[#ff6b35] transition-transform duration-1000 hover:rotate-[750deg] transform-gpu">
            <RxReload className="w-5 h-5" />
          </span>
        </div>
      </div>
    </div>

    {/* Discounted Rates Box */}
    <div className="bg-white px-6 pt-7 pb-4  w-full max-w-md rounded-[30px] shadow-xl space-y-2 relative">
      <div className="w-full">
        <p className="text-xl pb-2 font-semibold textColor">Discounted Rates</p>
        <p className="text-base py-1 text-black underline">Rates In Dollar $</p>
        <div className="text-4xl font-bold textColor tracking-tight border-b-2 border-gray-400 ">
          {rateData.discounted.toFixed(2)}
        </div>
      </div>

      <div className="flex items-start justify-between font-semibold text-xl gap-2 relative pt-2 text-black flex-col sm:flex-row">
        <p className="text-2xl font-normal text-black">In Rs :
          <span className="textColor font-semibold pl-1">
            {(rateData.discounted * Number(rate)).toFixed(2)}
          </span>
        </p>
        <div className="sm:absolute sm:-top-8 sm:right-2 flex flex-col  justify-center text-left gap-0">
          <p className="text-lg border-gray-400 font-semibold">Save $: <span className="textColor pl-1">{rateData.discountDollar.toFixed(2)}</span></p>
          <p className="text-lg font-semibold">Save Rs: <span className="textColor pl-1">
            {(rateData.discountDollar * Number(rate)).toFixed(2)}
          </span></p>
        </div>
      </div>

      <div className="absolute top-6 right-4 flex items-center gap-2">
        <div className="text-left leading-none">
          <div className="text-base font-semibold underline inline-flex items-center gap-1">
            <ChevronDown className="w-3 h-3" />
            {active === 'docs' ? 'DOCs' : 'PKG'}
          </div>
          <div className="text-xs text-gray-600 capitalize underline pl-4">{selectedCountry}</div>
        </div>
        <div className="w-10 h-10 rounded-[10px] border-2 py-1 border-gray-500 flex items-center justify-center">
          {active === 'docs' ? <IoDocumentsOutline className="text-black w-5 h-5" /> : <LuPackage className="text-black w-5 h-5" />}
        </div>
      </div>

      <div className="flex items-center justify-center pt-4">
        <button className="px-4 py-3 bg-[#ff6b35] shadow-lg shadow-[#ff6b358e] hover:shadow-[#59595c] text-white rounded-lg font-semibold text-sm hover:bg-[#59595c] duration-500 transition">
          Exchange Now
        </button>
      </div>
    </div>
  </div>
</div>

    );
}
