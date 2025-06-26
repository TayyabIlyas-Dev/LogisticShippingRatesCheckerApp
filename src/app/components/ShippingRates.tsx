'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ChevronDown } from "lucide-react";
import { LuPackage } from 'react-icons/lu';
import { IoDocumentsOutline } from 'react-icons/io5';
import { RxReload } from 'react-icons/rx';
import { docsData, pkgData, fetchShippingRates } from '../data/shippingRates';

export default function ShippingRates() {
    const [active, setActive] = useState<'docs' | 'pkg'>('docs');
    const [selectedCountry, setSelectedCountry] = useState('');
    const [selectedWeight, setSelectedWeight] = useState<number | undefined>(undefined);
    const [rateData, setRateData] = useState<{ original: number; discounted: number; discountDollar: number }>({ original: 0, discounted: 0, discountDollar: 0 });
    const [rate, setRate] = useState<string | null>(null); // default = null
    const [weightInput, setWeightInput] = useState('');
    const [docsData, setDocsData] = useState<Record<string, { original: number; discounted: number }>>({});
    const [pkgData, setPkgData] = useState<Record<string, { original: number; discounted: number }>>({});

    // File upload state
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadType, setUploadType] = useState<
        'retail' | 'pkg_discount' | 'docs_discount' | 'student' | 'zones' | 'docs' | 'zones_docs' | 'zones_pkg'
    >('docs');

    const [studentChecked, setStudentChecked] = useState(false);
    const [skippedLines, setSkippedLines] = useState<string[]>([]);
    const [showWeightOptions, setShowWeightOptions] = useState(false);

    const [countries, setCountries] = useState<string[]>([]);
    const [weights, setWeights] = useState<number[]>([]);
    const [showOptions, setShowOptions] = useState(false);
    const [highlightCountryIndex, setHighlightCountryIndex] = useState<number>(-1);
    const [highlightWeightIndex, setHighlightWeightIndex] = useState<number>(-1);






    // ✅ Filtered countries based on active tab
    const filteredCountries = useMemo(() => {
        const data = active === 'docs' ? docsData : pkgData;
        const countrySet = new Set<string>();

        Object.keys(data).forEach(key => {
            const [country] = key.split('_');
            countrySet.add(country);
        });

        const all = Array.from(countrySet);
        return [
            ...all.filter(c => selectedCountry && c.toLowerCase().startsWith(selectedCountry.toLowerCase())),
            ...all.filter(c => !selectedCountry || !c.toLowerCase().startsWith(selectedCountry.toLowerCase())),
        ];
    }, [active, selectedCountry, docsData, pkgData]);

    const filteredWeights = useMemo(() => {
        const data = active === 'docs' ? docsData : pkgData;
        const weightsSet = new Set<number>();

        Object.keys(data).forEach(key => {
            const [country, weightStr] = key.split('_');
            if (country === selectedCountry) {
                weightsSet.add(parseFloat(weightStr));
            }
        });

        const allWeights = Array.from(weightsSet).sort((a, b) => a - b);

        const matching = allWeights.filter(w =>
            weightInput && w.toFixed(1).startsWith(weightInput)
        );

        const rest = allWeights.filter(w =>
            !weightInput || !w.toFixed(1).startsWith(weightInput)
        );

        return [...matching, ...rest];
    }, [active, selectedCountry, weightInput, docsData, pkgData]);

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
    const updateRateData = useCallback(() => {
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
    }, [selectedCountry, selectedWeight, active, docsData, pkgData]);



    useEffect(() => {
        updateRateData();
    }, [updateRateData]);






    useEffect(() => {
        async function loadRates() {
            const { countries, weights, docsData, pkgData } = await fetchShippingRates();
            setCountries(countries);
            setWeights(weights);
            setDocsData(docsData);
            setPkgData(pkgData);
        }

        loadRates();
    }, []);

    // Upload handler
    async function handleUpload(e: React.FormEvent) {
        e.preventDefault();

        if (!fileInputRef.current?.files?.[0]) {
            setUploadMsg('Please select an Excel file.');
            return;
        }

        setUploading(true);
        setUploadMsg(null);

        const formData = new FormData();
        formData.append('file', fileInputRef.current.files[0]);
        formData.append('file_type', uploadType);
        formData.append('student', String(studentChecked));

        try {
            const res = await fetch('http://127.0.0.1:8000/upload-rates', {
                method: 'POST',
                body: formData,
            });

            const result = await res.json();

            if (!res.ok) {
                setUploadMsg('❌ ' + (result.detail || 'Upload failed.'));
                setSkippedLines([]);
            } else {
                setUploadMsg(result.message || '✅ Upload successful.');
                setSkippedLines(result.skipped_rows || []);
                await fetchShippingRates(); // Backend reload
            }
        } catch {
            setUploadMsg('❌ Upload failed.');
            setSkippedLines([]);
        } finally {
            setUploading(false); // ✅ Add this line
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }


    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#e8edf5] to-[#e6ebf3] px-4 py-10">
            <div className="w-full max-w-xl flex items-center justify-center flex-col relative">
                <h1 className="text-2xl md:text-3xl font-semibold text-center leading-[1] mb-8 text-black tracking-tight uppercase">Shipping Rates</h1>

                {/* Excel Upload UI */}
                <form onSubmit={handleUpload} className="mb-6 flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full justify-center">
                    {/* Dropdown for file type */}
                    <div className="flex gap-2 items-center text-black">
                        <label className="text-xs font-semibold">Type:</label>
                        <select
                            value={uploadType}
                            onChange={e => setUploadType(e.target.value as any)}
                            className="px-2 py-1 border border-gray-300 rounded-full text-xs focus:outline-none"
                            disabled={uploading}
                        >
                            <option value="retail">PKG Rates</option>
                            <option value="pkg_discount">PKG Discount</option>
                            <option value="docs_discount">Docs Discount</option>
                            <option value="student">Student Discount</option>
                            <option value="zones">Zones Countries</option>
                            <option value="zones_docs">Zones Docs</option>       {/* ✅ NEW */}
                            <option value="zones_pkg">Zones PKG</option>         {/* ✅ NEW */}
                            <option value="docs">Docs Rates</option>
                        </select>

                    </div>

                    {/* Conditionally show student checkbox */}
                    {uploadType === 'student' && (
                        <label className="flex items-center gap-1 text-xs font-medium">
                            <input
                                type="checkbox"
                                checked={studentChecked}
                                onChange={(e) => setStudentChecked(e.target.checked)}
                                className="form-checkbox rounded text-[#ff6b35]"
                            />
                            I'm uploading a student file
                        </label>
                    )}

                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        ref={fileInputRef}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#ff6b35] file:text-white hover:file:bg-[#59595c]"
                        disabled={uploading}
                    />

                    <button
                        type="submit"
                        className="px-4 py-2 bg-[#ff6b35] text-white rounded-lg font-semibold text-sm hover:bg-[#59595c] duration-300 transition"
                        disabled={uploading}
                    >
                        {uploading ? 'Uploading...' : 'Upload Excel'}
                    </button>
                </form>

                {/* Status message */}
                {uploadMsg && (
                    <div className={`mb-4 text-center text-sm ${uploadMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                        {uploadMsg}
                    </div>
                )}
                {skippedLines.length > 0 && (
                    <div className="bg-white border border-gray-300 rounded p-4 text-sm max-h-48 overflow-y-auto w-full shadow">
                        <div className="font-semibold text-gray-700 mb-1">⚠️ Skipped Rows:</div>
                        <ul className="list-disc pl-5 text-gray-600">
                            {skippedLines.map((line, idx) => (
                                <li key={idx}>{line}</li>
                            ))}
                        </ul>
                    </div>
                )}



                {/* Top Controls */}
                <div className='w-full pl-16 pr-14 text-black'>
                    <div className='flex my-1 flex-col sm:flex-row gap-3 items-center justify-around w-full rounded-3xl'>

                        <div className="flex items-center justify-center w-[335px] bg-white px-4 py-2.5 rounded-3xl sm:rounded-br-none  shadow-md  mb-0">
                            <div className="flex items-center  gap-1">
                                {/* <select className="px-2 py-1.5 border border-gray-300 rounded-full text-sm focus:outline-none">
            <option>Select Country</option>
        </select> */}
                                <div className="relative w-fit flex items-center gap-1 justify-center">
                                    <span className="text-[10px] pt-1 text-center block mb-1">
                                        <strong>Country :</strong>
                                    </span>
                                    <input
                                        value={selectedCountry}
                                        onChange={(e) => {
                                            setSelectedCountry(e.target.value);
                                            setShowOptions(true);
                                            setHighlightCountryIndex(-1);
                                        }}
                                        onFocus={() => setShowOptions(true)}
                                        onBlur={() => setTimeout(() => setShowOptions(false), 150)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setHighlightCountryIndex((prev) =>
                                                    prev < filteredCountries.length - 1 ? prev + 1 : 0
                                                );
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setHighlightCountryIndex((prev) =>
                                                    prev > 0 ? prev - 1 : filteredCountries.length - 1
                                                );
                                            } else if (e.key === 'Enter') {
                                                if (highlightCountryIndex >= 0 && highlightCountryIndex < filteredCountries.length) {
                                                    setSelectedCountry(filteredCountries[highlightCountryIndex]);
                                                    setShowOptions(false);
                                                    setHighlightCountryIndex(-1);
                                                }
                                            }
                                        }}

                                        placeholder="Type country..."
                                        className={`px-2.5 py-1.5 border uppercase border-gray-300 w-32 rounded-full focus:outline-none ${selectedCountry.length > 20
                                            ? 'text-[7px]'
                                            : selectedCountry.length > 10
                                                ? 'text-[9px]'
                                                : 'text-xs'
                                            }`}
                                    />

                                    {showOptions && filteredCountries.length > 0 && (
                                        <ul className="absolute z-50 top-6 left-14 mt-1 max-h-40 w-[7.75rem] overflow-y-auto bg-white border border-gray-300 rounded-lg shadow text-xs custom-scroll">
                                            {filteredCountries.map((country, index) => (
                                                <li
                                                    key={country}
                                                    className={`px-3 py-1 cursor-pointer uppercase ${highlightCountryIndex === index ? 'bg-gray-200' : 'hover:bg-gray-100'
                                                        }`}
                                                    onMouseDown={() => {
                                                        setSelectedCountry(country);
                                                        setShowOptions(false);
                                                        setHighlightCountryIndex(-1); // ✅ Update this too
                                                    }}
                                                >
                                                    {country}
                                                </li>
                                            ))}

                                        </ul>
                                    )}
                                </div>

                                {active === "pkg" ? (
                                    <div className="relative w-fit flex gap-1 items-center">
                                        <span className="text-[10px] pl-2 block mb-1 text-center">
                                            <strong>Kg :</strong>
                                        </span>
                                        <input
                                            type="text"
                                            value={weightInput}
                                            onChange={(e) => {
                                                const input = e.target.value;
                                                setWeightInput(input);
                                                const val = parseFloat(input);
                                                if (!isNaN(val)) {
                                                    setSelectedWeight(val);
                                                }
                                                setShowWeightOptions(true);
                                                setHighlightWeightIndex(-1);
                                            }}
                                            onFocus={() => setShowWeightOptions(true)}
                                            onBlur={() => setTimeout(() => setShowWeightOptions(false), 150)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    setHighlightWeightIndex((prev) =>
                                                        prev < filteredWeights.length - 1 ? prev + 1 : 0
                                                    );
                                                } else if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    setHighlightWeightIndex((prev) =>
                                                        prev > 0 ? prev - 1 : filteredWeights.length - 1
                                                    );
                                                } else if (e.key === 'Enter') {
                                                    if (highlightWeightIndex >= 0 && highlightWeightIndex < filteredWeights.length) {
                                                        const selected = filteredWeights[highlightWeightIndex];
                                                        setSelectedWeight(selected);
                                                        setWeightInput(selected.toString());
                                                        setShowWeightOptions(false);
                                                        setHighlightWeightIndex(-1);
                                                    }
                                                }
                                            }}
                                            placeholder=" Weight..."
                                            className="px-2.5 py-1.5 border  border-gray-300 w-20 rounded-full text-xs focus:outline-none"
                                        />

                                        {showWeightOptions && filteredWeights.length > 0 && (
                                            <ul className="absolute z-10 top-6 left-8 mt-1 max-h-40 w-24 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow text-xs custom-scroll">
                                                {filteredWeights.map((w, index) => (
                                                    <li
                                                        key={w}
                                                        className={`px-3 py-1 cursor-pointer ${highlightWeightIndex === index ? 'bg-gray-200' : 'hover:bg-gray-100'
                                                            }`}
                                                        onMouseDown={() => {
                                                            setSelectedWeight(w);
                                                            setWeightInput(w.toString());
                                                            setShowWeightOptions(false);
                                                            setHighlightWeightIndex(-1);
                                                        }}
                                                    >
                                                        {w}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ) : (
                                    // 📄 Docs: Dropdown style weight selector (ul based)
                                    <div className="relative w-fit flex gap-1 items-center">
                                        <span className="text-[10px] pl-2 block mb-1 text-center">
                                            <strong>Kg :</strong>
                                        </span>
                                        <input
                                            type="text"
                                            readOnly
                                            value={weightInput}
                                            onClick={() => setShowWeightOptions(true)}
                                            onBlur={() => setTimeout(() => setShowWeightOptions(false), 150)}
                                            placeholder="Weight..."
                                            className="px-2.5 py-1.5 border border-gray-300 w-20 rounded-full text-xs bg-white cursor-pointer focus:outline-none"
                                        />

                                        {showWeightOptions && (
                                            <ul className="absolute z-50 top-6 left-10 mt-1 max-h-40 w-[4.35rem] overflow-y-auto bg-white border border-gray-300 rounded-lg shadow text-xs custom-scroll">
                                                {[0.5, 1, 1.5, 2].map((w, index) => (
                                                    <li
                                                        key={w}
                                                        className={`px-3 py-1 cursor-pointer ${highlightWeightIndex === index ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                                                        onMouseDown={() => {
                                                            setSelectedWeight(w);
                                                            setWeightInput(w.toString());
                                                            setShowWeightOptions(false);
                                                            setHighlightWeightIndex(-1);
                                                        }}
                                                    >
                                                        {w}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                )}





                            </div>

                        </div>
                        <div className="flex items-center gap-2 ">

                            {/* Toggle Buttons */}
                            <div className="inline-flex items-center bg-[#f2f4f9] p-1 rounded-full border gap-1 border-gray-300 text-[10px] font-medium">
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

                    <div className="absolute top-[54%] right-4 text-black text-sm md:text-sm font-semibold pr-2">
                        Dollar Rate : <span className="textColor">Rs {rate !== null ? Math.round(parseFloat(rate)) : 'N/A '}</span>
                    </div>

                    <div className="absolute top-6 right-4 flex items-center justify-center gap-2">
                        <div className="text-left leading-none">
                            <div className="text-base font-semibold underline inline-flex text-black items-center gap-1">
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
                    <div className="absolute left-1/2 -translate-x-1/2 -top-5 z-10  bg-[#e9e6e6] p-[1.5px] rounded-full ">
                        <div
                            className="w-10 h-10 rounded-full bg-white  border flex items-center justify-center shadow-sm cursor-pointer"
                            onClick={() => window.location.reload()}
                        >
                            <span className="text-gray-700 font-semibold hover:text-[#ff6b35] transition-transform duration-1000 hover:rotate-[750deg] transform-gpu">
                                <RxReload className="w-5 h-5" />
                            </span>
                        </div>
                    </div>
                </div>
                < div className="bg-white px-6 pt-7 pb-4  w-full max-w-md rounded-[30px] shadow-xl space-y-2 relative">

                    {rateData.discounted !== null &&
                        rateData.discounted > 0 ? (
                        <div>

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
                                    <div className="text-base font-semibold underline text-black inline-flex items-center gap-1">
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

                    ) : (
                        <div className="text-xl text-center font-semibold textColor py-4">

                        {selectedCountry && selectedWeight
                            ? 'Sorry! No deals found for your combination.'
                            : '! Please enter the required fields.'}
                    </div>
                    )}
                </div>

            </div>
        </div >
    );
}
