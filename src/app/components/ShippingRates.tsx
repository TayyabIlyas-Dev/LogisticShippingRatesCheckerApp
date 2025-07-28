'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ChevronDown } from "lucide-react";
import { LuPackage } from 'react-icons/lu';
import { IoDocumentsOutline } from 'react-icons/io5';
import { RxReload } from 'react-icons/rx';
import { fetchShippingRates, ShippingRate, surchargesData } from '../data/shippingRates';
import { SignedIn } from '@clerk/nextjs';
import { useUser } from "@clerk/nextjs";
import AnimatedTriangle from './3DTriangles';
import { MoreVertical } from 'lucide-react'; // You can use any 3-dot icon


export default function ShippingRates() {
    const [active, setActive] = useState<'docs' | 'pkg'>('pkg');
    const [sheetNumber, setSheetNumber] = useState(1);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [selectedCountry, setSelectedCountry] = useState('');
    const [selectedWeight, setSelectedWeight] = useState<number | undefined>(undefined);
    const [rateData, setRateData] = useState<{
        original: number;
        discounted: number;
        discountDollar: number;
        surcharge: number; // ✅ Add this line
    }>({
        original: 0,
        discounted: 0,
        discountDollar: 0,
        surcharge: 0, // ✅ Initial value
    });

    const [rate, setRate] = useState<string | null>(null); // default = null
    const [weightInput, setWeightInput] = useState('');
    const [docsData, setDocsData] = useState<Record<string, { original: number; discounted: number }>>({});
    const [pkgData, setPkgData] = useState<Record<string, { original: number; discounted: number }>>({});

    // File upload state
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadType, setUploadType] = useState<
        'retail' | 'pkg_discount' | 'docs_discount' | 'student' | 'zones' | 'docs' | 'zones_docs' | 'zones_pkg' | 'addkg' | 'zoneaddkg' | 'surcharges'
    >('docs');

    const [studentChecked, setStudentChecked] = useState(false);
    const [skippedLines, setSkippedLines] = useState<string[]>([]);
    const [showWeightOptions, setShowWeightOptions] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [countries, setCountries] = useState<string[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars

    const [weights, setWeights] = useState<number[]>([]);
    const [showOptions, setShowOptions] = useState(false);
    const [highlightCountryIndex, setHighlightCountryIndex] = useState<number>(-1);
    const [highlightWeightIndex, setHighlightWeightIndex] = useState<number>(-1);
    const [addkgData, setAddkgData] = useState<Record<string, ShippingRate>>({});
    const [surchargesData, setSurchargesData] = useState<Record<string, number>>({});







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
        if (!selectedCountry || !selectedWeight) {
            setRateData({ original: 0, discounted: 0, discountDollar: 0, surcharge: 0 });
            return;
        }
    
        // 🔒 Special rule for DOCS: above 2kg → all rates = 0, only surcharge apply
        if (active === 'docs' && selectedWeight > 2) {
            const surcharge = surchargesData[selectedCountry.toLowerCase()] || 0;
            setRateData({
                original: 0 ,
                discounted: 0,
                discountDollar: 0,
                surcharge,
            });
            return;
        }
    
        const key = `${selectedCountry}_${selectedWeight}`;
        const baseData = active === 'docs' ? docsData[key] : pkgData[key];
        const discounted = baseData?.discounted || 0;
    
        // Use 25kg as base if weight > 25 (pkg only)
        let originalBaseKey = key;
        if (selectedWeight > 25) {
            originalBaseKey = `${selectedCountry}_25`;
        }
    
        const baseOriginalData =
            active === 'docs' ? docsData[originalBaseKey] : pkgData[originalBaseKey];
    
        let original = baseOriginalData?.original || 0;
    
        // 📦 AddKG apply only for 'pkg'
        if (active === 'pkg' && selectedWeight > 25) {
            const matchedAddkg = Object.entries(addkgData).find(([key, val]) => {
                const countryFromKey = key.split("_")[0].toLowerCase();
                return countryFromKey === selectedCountry.toLowerCase() && val.addkg;
            });
    
            const addkgRate = matchedAddkg?.[1] ?? null;
    
            if (addkgRate?.addkg) {
                const weightDiff = selectedWeight - 25;
                const fullUnits = Math.floor(weightDiff);
                const halfUnit = weightDiff % 1 !== 0 ? 0.5 : 0;
                const addCharge = (fullUnits + halfUnit) * addkgRate.addkg;
                original += addCharge;
            }
        }
    
        // ✅ Surcharge always apply
        const surcharge = surchargesData[selectedCountry.toLowerCase()] || 0;
        original += surcharge;
    
        setRateData({
            original,
            discounted,
            discountDollar: original - discounted,
            surcharge,
        });
    }, [selectedCountry, selectedWeight, active, docsData, pkgData, addkgData, surchargesData]);
    


    useEffect(() => {
        updateRateData();
    }, [updateRateData]);





    useEffect(() => {
        async function loadRates() {
            const { countries, weights, docsData, pkgData, addkgData, surchargesData } = await fetchShippingRates();
            setCountries(countries);
            setWeights(weights);
            setDocsData(docsData);
            setPkgData(pkgData);
            setAddkgData(addkgData);
            setSurchargesData(surchargesData);

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
        formData.append('sheet', String(sheetNumber));


        try {

            const res = await fetch('https://06d75d5e-523a-4ae0-9015-f96e9ebb379b-00-2htr8edtkrdqn.pike.replit.dev:8000/upload-rates', {
            // const res = await fetch('http://127.0.0.1:8000/upload-rates', {

                method: 'POST',
                body: formData,
            });

            const result = await res.json();

            if (!res.ok) {
                setUploadMsg('❌ ' + (result.detail || 'Upload failed.'));
                setSkippedLines([]);
                setTimeout(() => {
                    setUploadMsg('');
                }, 10000);
            } else {
                setUploadMsg(result.message || '✅ Upload successful.');
                setSkippedLines(result.skipped_rows || []);
                const updated = await fetchShippingRates();
                setCountries(updated.countries);
                setWeights(updated.weights);
                setDocsData(updated.docsData);
                setPkgData(updated.pkgData);
                setAddkgData(updated.addkgData);
                setSurchargesData(updated.surchargesData);
                setTimeout(() => {
                    setUploadMsg('');
                }, 10000);
            }
        } catch {
            setUploadMsg('❌ Upload failed.');
            setSkippedLines([]);
            setTimeout(() => {
                setUploadMsg('');
            }, 10000);
        } finally {
            setUploading(false); // ✅ Add this line
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }



    const handleClear = async () => {
        const confirm = window.confirm('Are you sure you want to clear the entire database?')
        if (!confirm) return

        setLoading(true)
        setMessage('')

        try {
            const res = await fetch('/api/clear-database', {
                method: 'DELETE',
            })

            const data = await res.json()
            if (!res.ok) {
                setMessage(`❌ Error: ${data.error}`)
            } else {
                setMessage(`✅ ${data.message}`)
            }

            // 🔻 Auto-clear message after 3 seconds
            setTimeout(() => {
                setMessage('')
            }, 10000)
        } catch (err) {
            setMessage('❌ Network or server error')
            setTimeout(() => {
                setMessage('')
            }, 10000)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);



    const { user } = useUser();

    const isAdmin = user?.publicMetadata?.role === "admin";

    return (
        <div
            className="min-h-screen flex justify-center px-4 pb-10 pt-16 relative"
            style={{
                background: 'radial-gradient(circle at center, #f2f7fc 12%, #d7e2f4 70%, #c0d0e4 95%)',
            }}
        >
            {/* Main content area with triangle background */}
            <div className="relative w-full h-full sm:h-[115vh] overflow-hidden z-0">

                {/* Left Triangle Group */}
                <div className="absolute -left-[12%]  sm:-left-[10%] md:-left-[2%] xmd:left-[2%] lg:left-[12%] xl:left-[15%]   2xl:left-[19%] top-[1%] w-[15%]  h-[90%] -z-10 pointer-events-none">
                    <AnimatedTriangle
                        className1="absolute top-[23%] xsm:-right-[44%] md:left-[50%] w-12 h-12 rotate-[160deg] z-0"
                        className2="absolute xsm:top-[36%] md:top-[28%] xsm:-right-[58%] md:left-[44%] w-20 h-28 animate-float z-0"
                    />
                    <AnimatedTriangle
                        className1="absolute top-[24%] xsm:-right-[41%] md:left-[30%] xl:left-[36%] w-32 h-32 md:w-36 md:h-36 rotate-[120deg] z-0"
                        className2="absolute xsm:top-[28%] md:top-[38%] xsm:-right-[8%]  md:left-[79%] w-16 h-16 animate-float z-0"
                    />
                    <AnimatedTriangle
                        className1="absolute xsm:top-[30%] md:top-[32%] xsm:-right-[99%] md:left-[53%] w-20 h-20  rotate-[300deg] z-0"
                        className2="absolute top-[17%] xsm:-right-[1%] md:left-[69%] w-14 h-14 rotate-[163deg] z-0"
                    />
                </div>

                {/* Right Triangle Group */}
                <div className="absolute right-[12%]  xsm:-right-[13%] md:-right-[5%] xmd:right-[3%] lg:right-[8%] xl:right-[12%] 2xl:right-[17%] top-[1%] w-[16%]  h-[95%] -z-10 pointer-events-none">
                    <AnimatedTriangle
                        className1="absolute top-[34%] right-[75%]  w-20 h-36 animate-float2 z-0"
                        className2="absolute top-[36%] right-[58%] w-16 h-24   -rotate-[100deg] z-0"
                    />
                    <AnimatedTriangle
                        className1="absolute top-[36%] xsm:right-[5%] md:right-[10%] w-48 h-52 rotate-[289deg] z-10"
                        className2="absolute xsm:top-[62%] md:top-[60%] lg:top-[56%] xsm:-left-[58%] md:right-[96%] xmd:right-[89%] lg:left-[44%] xl:right-[39%] 2xl:right-[39%] w-16 h-20   md:w-14 md:h-16 z-0"
                    />
                    <AnimatedTriangle
                        className1="absolute top-[60%] right-[42%]  w-20 h-24 -rotate-[50deg] z-0"
                        className2="absolute  top-[59%] xl:top-[53%] xmd:hidden  lg:block lg:-left-[70%] xl:-left-[62%] 2xl:-left-[60%] w-32 h-36 rotate-[110deg]  z-10"
                    />
                </div>

                {/* Foreground Content */}
                <div className="relative z-10 p-2 sm:p-8 flex justify-center">





                    <div className="w-full max-w-xl flex items-center  flex-col relative">
                        <h1 className="py-3 text-2xl md:text-3xl font-semibold text-center leading-[1] mb-2 text-black tracking-tight uppercase">Shipping Rates</h1>

                        <SignedIn>      {/* Excel Upload UI */}
                            {isAdmin ? (
                                <>
                                    <form onSubmit={handleUpload} className="mb-6 py-2 flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full justify-center">
                                        {/* Dropdown for file type */}

                                        <div className='flex flex-col sm:flex-row gap-3 items-center w-full'>

                                            <div className="flex gap-2 items-center text-black">
                                            <div className="relative inline-block text-left" ref={dropdownRef}>
                                                <button
                                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                                    className="inline-flex justify-center items-center p-1 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>

                                                {dropdownOpen && (
                                                    <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                                                        <button
                                                            onClick={handleClear}
                                                            disabled={loading}
                                                            className="w-full text-left px-4 py-2 text-sm textColor hover:bg-gray-100 hover:text-gray-600 transition"
                                                        >
                                                            {loading ? 'Clearing...' : '🗑️ Clear Database'}
                                                        </button>
                                                    </div>
                                                )}


                                            </div>

                                                <label className="text-xs font-semibold">Type:</label>
                                                <select
                                                    value={uploadType}
                                                    onChange={e => setUploadType(e.target.value as any)}
                                                    className="px-2 py-1 border border-gray-300 rounded-full text-xs focus:outline-none"
                                                    disabled={uploading}
                                                >
                                                    <option value="retail">PKG Rates</option>
                                                    <option value="pkg_discount">PKG Discount</option>
                                                    <option value="zones">Zones Countries</option>
                                                    <option value="zones_docs">Zones Docs</option>       {/* ✅ NEW */}
                                                    <option value="zones_pkg">Zones PKG</option>         {/* ✅ NEW */}
                                                    <option value="docs">Docs Rates</option>
                                                    <option value="addkg">ADD PER KG</option>
                                                    <option value="zoneaddkg">Zone ADD PER KG</option>
                                                    <option value="docs_discount">Docs Discount</option>
                                                    <option value="surcharges">Surcharges Rate</option>

                                                    <option value="student">Student Discount</option>
                                                    surcharges
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

                                            <div>
                                                <input
                                                    type="file"
                                                    accept=".xlsx,.xls"
                                                    ref={fileInputRef}
                                                    className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#ff6b35] file:text-white hover:file:bg-[#59595c]"
                                                    disabled={uploading}
                                                />
                                            </div>
                                            <div className="flex gap-2 items-center text-black">
                                                <label className="text-[8px] font-semibold">Sheet:</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={sheetNumber}
                                                    onChange={(e) => setSheetNumber(Number(e.target.value))}
                                                    className="w-12 px-2 py-1 border border-gray-300 rounded-full text-xs focus:outline-none"
                                                    disabled={uploading}
                                                />
                                            </div>


                                            <button
                                                type="submit"
                                                className="px-4 py-2 bg-[#ff6b35] text-white rounded-lg font-semibold text-xs hover:bg-[#59595c] duration-300 transition"
                                                disabled={uploading}
                                            >
                                                {uploading ? 'Uploading...' : 'Upload'}
                                            </button>
                                        </div>
                                    </form>
                                    {/* Status message */}
                                    {uploadMsg && (
                                        <div className={`mb-4 text-center text-sm ${uploadMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{uploadMsg}
                                            {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
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
                                </>

                            ) : (
                                <p className="text-center text-sm text-red-600">
                                    You are not a Admin So U not have permission to Upload Rates & discounts
                                </p>
                            )}


                        </SignedIn>

                        {/* Top Controls */}
                        <div className='w-full pl-16 pr-14 text-black'>
                            <div className='flex my-1 flex-col sm:flex-row gap-3 items-center justify-around w-full rounded-3xl'>

                                <div className="flex items-center justify-center w-[320px] sm:w-[335px] bg-white px-4 py-2.5 rounded-3xl sm:rounded-br-none  shadow-md  mb-0">
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
                                                className={`px-2.5 py-1.5 border uppercase z-20 border-gray-300 w-32 rounded-full focus:outline-none ${selectedCountry.length > 20
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
                                                    className="px-2.5 py-1.5 border   border-gray-300 w-16 sm:w-20 rounded-full text-[10px] sm:text-xs  focus:outline-none"
                                                />

                                                {showWeightOptions && filteredWeights.length > 0 && (
                                                    <ul className="absolute z-30 top-6 left-8 mt-1 max-h-40 w-24 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow text-xs custom-scroll">
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
                                                    className="px-2.5 py-1.5 border border-gray-300 w-16 sm:w-20 rounded-full text-[10px] sm:text-xs  bg-white cursor-pointer focus:outline-none"
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
                                        <button
                                            onClick={() => setActive('docs')}
                                            className={`px-3 py-1.5 rounded-full transition-all duration-300 ${active === 'docs'
                                                ? 'bg-gray-300 text-black shadow-sm'
                                                : 'text-gray-500 hover:bg-gray-200'
                                                }`}
                                        >
                                            Docs
                                        </button>

                                        {/* PKG Toggle */}
                                        <button
                                            onClick={() => setActive('pkg')}
                                            className={`px-3 py-1.5 rounded-full transition-all duration-300 ${active === 'pkg'
                                                ? 'bg-orange-500 text-white shadow-sm'
                                                : 'text-gray-500 hover:bg-orange-300'
                                                }`}
                                        >
                                            PKG
                                        </button>

                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Exchange Box */}
                        <div className="bg-white p-5 sm:p-6 rounded-[30px] mt-1 w-full max-w-md shadow-xl space-y-2 relative  z-20">
                            <div className="w-full">
                                <p className="text-base py-1 text-black underline">Rates In Dollar $</p>
                                <div className="text-4xl border-b-2 font-geist border-b-gray-400 font-bold textColor tracking-tight">
                                    {rateData.original.toFixed(2)}
                                </div>
                                <p className="text-xl sm:text-2xl pt-3 text-black">In Rs :
                                    <span className="textColor font-semibold pl-1">
                                        {rate ? (rateData.original * parseFloat(rate)).toFixed(2) : 'Loading...'}
                                    </span>
                                </p>
                                {rateData.surcharge > 0 && rate && (
                                    <p className="text-xs sm:text-sm font-semibold text-red-500 pt-1 px-1">
                                         ⚠️ Surcharges added $ : {rateData.surcharge}
                                    </p>
                                )}

                            </div>

                            <div className="absolute top-[54%] right-4 text-black  md:text-sm font-semibold pr-2">
                                <span className='text-[10px]'>

                                Dollar Rate : 
                                </span>
                                <span className="textColor text-[12px]"> Rs {rate !== null ? Math.round(parseFloat(rate)) : 'N/A '}</span>
                            </div>

                            <div className="absolute top-6 right-4 flex items-center justify-center gap-2">
                                <div className="text-left leading-none">
                                    <div className="text-sm sm:text-base font-semibold underline inline-flex text-black items-center gap-1">
                                        <ChevronDown className="w-3 h-3" />
                                        {active === 'docs' ? 'DOCs' : 'PKG'}
                                    </div>
                                    <div className=" text-[10px] sm:text-xs text-gray-500 uppercase underline pl-4">{selectedCountry}</div>
                                </div>
                                <div className="w-10 h-10 rounded-[10px] border-2 py-1 border-gray-500 flex items-center justify-center">
                                    {active === 'docs' ? <IoDocumentsOutline className="text-black w-4 h-4 sm:w-5 sm:h-5" /> : <LuPackage className="text-black w-5 h-5" />}
                                </div>
                            </div>
                        </div>

                        <div className="relative w-full max-w-md my-1  z-40">
                            <div className="absolute left-1/2 -translate-x-1/2 -top-5 z-10  bg-[#e9e6e6] p-[1.5px] rounded-full ">
                                <div
                                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white  border flex items-center justify-center shadow-sm cursor-pointer"
                                    onClick={() => window.location.reload()}
                                >
                                    <span className="text-gray-700 font-semibold hover:text-[#ff6b35] transition-transform duration-1000 hover:rotate-[750deg] transform-gpu">
                                        <RxReload className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </span>
                                </div>
                            </div>
                        </div>
                        < div className="bg-white px-5 sm:px-6 pt-7 pb-4  w-full max-w-md rounded-[30px] shadow-xl space-y-2 relative  z-30">

                            {rateData.discounted !== null &&
                                rateData.discounted > 0 ? (
                                <div>

                                    <div className="w-full">

                                        <p className="text-lg sm:text-xl pb-2 font-semibold textColor">Discounted Rates</p>
                                        <p className="text-base py-1 text-black underline">Rates In Dollar $</p>
                                        <div className="text-4xl font-bold textColor tracking-tight border-b-2 border-gray-400 ">
                                            {rateData.discounted.toFixed(2)}
                                        </div>
                                    </div>

                                    <div className="flex items-start justify-between font-semibold text-xl gap-2 relative pt-2 text-black flex-col sm:flex-row">
                                        <p className="text-xl sm:text-2xl font-normal text-black">In Rs :
                                            <span className="textColor font-semibold pl-1">
                                                {(rateData.discounted * Number(rate)).toFixed(2)}
                                            </span>
                                        </p>
                                        <div className="sm:absolute sm:-top-8 sm:right-2 flex flex-col  justify-center text-left gap-0">
                                            <p className="text-base sm:text-lg border-gray-400 font-semibold">Save $: <span className="textColor pl-1">{rateData.discountDollar.toFixed(2)}</span></p>
                                            <p className="text-base sm:text-lg font-semibold">Save Rs: <span className="textColor pl-1">
                                                {(rateData.discountDollar * Number(rate)).toFixed(2)}
                                            </span></p>
                                        </div>
                                    </div>

                                    <div className="absolute top-6 right-4 flex items-center gap-2">
                                        <div className="text-left leading-none">
                                            <div className="text-xs sm:text-base font-semibold underline text-black inline-flex items-center gap-1">
                                                <ChevronDown className="w-3 h-3" />
                                                {active === 'docs' ? 'DOCs' : 'PKG'}
                                            </div>
                                            <div className="text-[9px] sm:text-xs text-gray-600 uppercase underline pl-4">{selectedCountry}</div>
                                        </div>
                                        <div className="w-10 h-10 rounded-[10px] border-2 py-1 border-gray-500 flex items-center justify-center">
                                            {active === 'docs' ? <IoDocumentsOutline className="text-black w-4 h-3 sm:w-5 sm:h-5" /> : <LuPackage className="text-black w-5 h-5" />}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center pt-4">
                                        <button className="px-4 py-3 w-full bg-[#ff6b35] shadow-lg shadow-[#ff6b358e] hover:shadow-[#59595c] text-white rounded-full font-semibold text-xs sm:text-sm hover:bg-[#59595c] duration-500 transition">
                                            These are Expected Rates
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




                </div>
            </div>





            <div
                className="fixed -bottom-6 -right-12 w-52 h-24 rounded-full"
                style={{
                    backgroundColor: 'white',
                    opacity: 10,           // Bohat kam opacity
                    filter: 'blur(60px)',   // Full blur
                    zIndex: 0,              // Peechay rahe sab ke
                }}
            />

            <div
                className="fixed -bottom-6 -left-12 w-60 h-24 rounded-full"
                style={{
                    backgroundColor: 'white',
                    opacity: 10,           // Bohat kam opacity
                    filter: 'blur(50px)',   // Full blur
                    zIndex: 0,              // Peechay rahe sab ke
                }}
            />

        </div >
    );
}




// <div className="w-full max-w-xl flex items-center  flex-col relative">
// <h1 className="py-3 text-2xl md:text-3xl font-semibold text-center leading-[1] mb-2 text-black tracking-tight uppercase">Shipping Rates</h1>

// <SignedIn>      {/* Excel Upload UI */}
//     {isAdmin ? (
//         <>
//             <form onSubmit={handleUpload} className="mb-6 flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full justify-center">
//                 {/* Dropdown for file type */}

//                 <div className='flex gap-3 items-center w-full'>

//                     <div className="flex gap-2  items-center text-black">
//                         <label className="text-xs font-semibold">Type:</label>
//                         <select
//                             value={uploadType}
//                             onChange={e => setUploadType(e.target.value as any)}
//                             className="px-2 py-1 border border-gray-300 rounded-full text-xs focus:outline-none"
//                             disabled={uploading}
//                         >
//                             <option value="retail">PKG Rates</option>
//                             <option value="pkg_discount">PKG Discount</option>
//                             <option value="docs_discount">Docs Discount</option>
//                             <option value="student">Student Discount</option>
//                             <option value="zones">Zones Countries</option>
//                             <option value="zones_docs">Zones Docs</option>       {/* ✅ NEW */}
//                             <option value="zones_pkg">Zones PKG</option>         {/* ✅ NEW */}
//                             <option value="docs">Docs Rates</option>
//                         </select>

//                     </div>

//                     {/* Conditionally show student checkbox */}
//                     {uploadType === 'student' && (
//                         <label className="flex items-center gap-1 text-xs font-medium">
//                             <input
//                                 type="checkbox"
//                                 checked={studentChecked}
//                                 onChange={(e) => setStudentChecked(e.target.checked)}
//                                 className="form-checkbox rounded text-[#ff6b35]"
//                             />
//                             I'm uploading a student file
//                         </label>
//                     )}

//                     <input
//                         type="file"
//                         accept=".xlsx,.xls"
//                         ref={fileInputRef}
//                         className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#ff6b35] file:text-white hover:file:bg-[#59595c]"
//                         disabled={uploading}
//                     />

//                     <button
//                         type="submit"
//                         className="px-4 py-2 bg-[#ff6b35] text-white rounded-lg font-semibold text-sm hover:bg-[#59595c] duration-300 transition"
//                         disabled={uploading}
//                     >
//                         {uploading ? 'Uploading...' : 'Upload Excel'}
//                     </button>
//                 </div>
//             </form>
//             {/* Status message */}
//             {uploadMsg && (
//                 <div className={`mb-4 text-center text-sm ${uploadMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{uploadMsg}</div>
//             )}
//             {skippedLines.length > 0 && (
//                 <div className="bg-white border border-gray-300 rounded p-4 text-sm max-h-48 overflow-y-auto w-full shadow">
//                     <div className="font-semibold text-gray-700 mb-1">⚠️ Skipped Rows:</div>
//                     <ul className="list-disc pl-5 text-gray-600">
//                         {skippedLines.map((line, idx) => (
//                             <li key={idx}>{line}</li>
//                         ))}
//                     </ul>
//                 </div>


//             )}
//         </>

//     ) : (
//         <p className="text-center text-sm text-red-600">
//             You are not a Admin So U not have permission to Upload Rates & discounts
//         </p>
//     )}


// </SignedIn>

// {/* Top Controls */}
// <div className='w-full pl-16 pr-14 text-black'>
//     <div className='flex my-1 flex-col sm:flex-row gap-3 items-center justify-around w-full rounded-3xl'>

//         <div className="flex items-center justify-center w-[335px] bg-white px-4 py-2.5 rounded-3xl sm:rounded-br-none  shadow-md  mb-0">
//             <div className="flex items-center  gap-1">
//                 {/* <select className="px-2 py-1.5 border border-gray-300 rounded-full text-sm focus:outline-none">
// <option>Select Country</option>
// </select> */}
//                 <div className="relative w-fit flex items-center gap-1 justify-center">
//                     <span className="text-[10px] pt-1 text-center block mb-1">
//                         <strong>Country :</strong>
//                     </span>
//                     <input
//                         value={selectedCountry}
//                         onChange={(e) => {
//                             setSelectedCountry(e.target.value);
//                             setShowOptions(true);
//                             setHighlightCountryIndex(-1);
//                         }}
//                         onFocus={() => setShowOptions(true)}
//                         onBlur={() => setTimeout(() => setShowOptions(false), 150)}
//                         onKeyDown={(e) => {
//                             if (e.key === 'ArrowDown') {
//                                 e.preventDefault();
//                                 setHighlightCountryIndex((prev) =>
//                                     prev < filteredCountries.length - 1 ? prev + 1 : 0
//                                 );
//                             } else if (e.key === 'ArrowUp') {
//                                 e.preventDefault();
//                                 setHighlightCountryIndex((prev) =>
//                                     prev > 0 ? prev - 1 : filteredCountries.length - 1
//                                 );
//                             } else if (e.key === 'Enter') {
//                                 if (highlightCountryIndex >= 0 && highlightCountryIndex < filteredCountries.length) {
//                                     setSelectedCountry(filteredCountries[highlightCountryIndex]);
//                                     setShowOptions(false);
//                                     setHighlightCountryIndex(-1);
//                                 }
//                             }
//                         }}

//                         placeholder="Type country..."
//                         className={`px-2.5 py-1.5 border uppercase border-gray-300 w-32 rounded-full focus:outline-none ${selectedCountry.length > 20
//                             ? 'text-[7px]'
//                             : selectedCountry.length > 10
//                                 ? 'text-[9px]'
//                                 : 'text-xs'
//                             }`}
//                     />

//                     {showOptions && filteredCountries.length > 0 && (
//                         <ul className="absolute z-50 top-6 left-14 mt-1 max-h-40 w-[7.75rem] overflow-y-auto bg-white border border-gray-300 rounded-lg shadow text-xs custom-scroll">
//                             {filteredCountries.map((country, index) => (
//                                 <li
//                                     key={country}
//                                     className={`px-3 py-1 cursor-pointer uppercase ${highlightCountryIndex === index ? 'bg-gray-200' : 'hover:bg-gray-100'
//                                         }`}
//                                     onMouseDown={() => {
//                                         setSelectedCountry(country);
//                                         setShowOptions(false);
//                                         setHighlightCountryIndex(-1); // ✅ Update this too
//                                     }}
//                                 >
//                                     {country}
//                                 </li>
//                             ))}

//                         </ul>
//                     )}
//                 </div>

//                 {active === "pkg" ? (
//                     <div className="relative w-fit flex gap-1 items-center">
//                         <span className="text-[10px] pl-2 block mb-1 text-center">
//                             <strong>Kg :</strong>
//                         </span>
//                         <input
//                             type="text"
//                             value={weightInput}
//                             onChange={(e) => {
//                                 const input = e.target.value;
//                                 setWeightInput(input);
//                                 const val = parseFloat(input);
//                                 if (!isNaN(val)) {
//                                     setSelectedWeight(val);
//                                 }
//                                 setShowWeightOptions(true);
//                                 setHighlightWeightIndex(-1);
//                             }}
//                             onFocus={() => setShowWeightOptions(true)}
//                             onBlur={() => setTimeout(() => setShowWeightOptions(false), 150)}
//                             onKeyDown={(e) => {
//                                 if (e.key === 'ArrowDown') {
//                                     e.preventDefault();
//                                     setHighlightWeightIndex((prev) =>
//                                         prev < filteredWeights.length - 1 ? prev + 1 : 0
//                                     );
//                                 } else if (e.key === 'ArrowUp') {
//                                     e.preventDefault();
//                                     setHighlightWeightIndex((prev) =>
//                                         prev > 0 ? prev - 1 : filteredWeights.length - 1
//                                     );
//                                 } else if (e.key === 'Enter') {
//                                     if (highlightWeightIndex >= 0 && highlightWeightIndex < filteredWeights.length) {
//                                         const selected = filteredWeights[highlightWeightIndex];
//                                         setSelectedWeight(selected);
//                                         setWeightInput(selected.toString());
//                                         setShowWeightOptions(false);
//                                         setHighlightWeightIndex(-1);
//                                     }
//                                 }
//                             }}
//                             placeholder=" Weight..."
//                             className="px-2.5 py-1.5 border  border-gray-300 w-20 rounded-full text-xs focus:outline-none"
//                         />

//                         {showWeightOptions && filteredWeights.length > 0 && (
//                             <ul className="absolute z-10 top-6 left-8 mt-1 max-h-40 w-24 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow text-xs custom-scroll">
//                                 {filteredWeights.map((w, index) => (
//                                     <li
//                                         key={w}
//                                         className={`px-3 py-1 cursor-pointer ${highlightWeightIndex === index ? 'bg-gray-200' : 'hover:bg-gray-100'
//                                             }`}
//                                         onMouseDown={() => {
//                                             setSelectedWeight(w);
//                                             setWeightInput(w.toString());
//                                             setShowWeightOptions(false);
//                                             setHighlightWeightIndex(-1);
//                                         }}
//                                     >
//                                         {w}
//                                     </li>
//                                 ))}
//                             </ul>
//                         )}
//                     </div>
//                 ) : (
//                     // 📄 Docs: Dropdown style weight selector (ul based)
//                     <div className="relative w-fit flex gap-1 items-center">
//                         <span className="text-[10px] pl-2 block mb-1 text-center">
//                             <strong>Kg :</strong>
//                         </span>
//                         <input
//                             type="text"
//                             readOnly
//                             value={weightInput}
//                             onClick={() => setShowWeightOptions(true)}
//                             onBlur={() => setTimeout(() => setShowWeightOptions(false), 150)}
//                             placeholder="Weight..."
//                             className="px-2.5 py-1.5 border border-gray-300 w-20 rounded-full text-xs bg-white cursor-pointer focus:outline-none"
//                         />

//                         {showWeightOptions && (
//                             <ul className="absolute z-50 top-6 left-10 mt-1 max-h-40 w-[4.35rem] overflow-y-auto bg-white border border-gray-300 rounded-lg shadow text-xs custom-scroll">
//                                 {[0.5, 1, 1.5, 2].map((w, index) => (
//                                     <li
//                                         key={w}
//                                         className={`px-3 py-1 cursor-pointer ${highlightWeightIndex === index ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
//                                         onMouseDown={() => {
//                                             setSelectedWeight(w);
//                                             setWeightInput(w.toString());
//                                             setShowWeightOptions(false);
//                                             setHighlightWeightIndex(-1);
//                                         }}
//                                     >
//                                         {w}
//                                     </li>
//                                 ))}
//                             </ul>
//                         )}
//                     </div>

//                 )}





//             </div>

//         </div>
//         <div className="flex items-center gap-2 ">

//             {/* Toggle Buttons */}
//             <div className="inline-flex items-center bg-[#f2f4f9] p-1 rounded-full border gap-1 border-gray-300 text-[10px] font-medium">
//                 <button
//                     onClick={() => setActive('docs')}
//                     className={`px-3 py-1.5 rounded-full transition-all duration-300 ${active === 'docs'
//                         ? 'bg-gray-300 text-black shadow-sm'
//                         : 'text-gray-500 hover:bg-gray-200'
//                         }`}
//                 >
//                     Docs
//                 </button>

//                 {/* PKG Toggle */}
//                 <button
//                     onClick={() => setActive('pkg')}
//                     className={`px-3 py-1.5 rounded-full transition-all duration-300 ${active === 'pkg'
//                         ? 'bg-orange-500 text-white shadow-sm'
//                         : 'text-gray-500 hover:bg-orange-300'
//                         }`}
//                 >
//                     PKG
//                 </button>

//             </div>
//         </div>
//     </div>
// </div>

// {/* Main Exchange Box */}
// <div className="bg-white p-6 rounded-[30px] mt-1 w-full max-w-md shadow-xl space-y-2 relative  z-20">
//     <div className="w-full">
//         <p className="text-base py-1 text-black underline">Rates In Dollar $</p>
//         <div className="text-4xl border-b-2 font-geist border-b-gray-400 font-bold textColor tracking-tight">
//             {rateData.original.toFixed(2)}
//         </div>
//         <p className="text-2xl pt-3 text-black">In Rs :
//             <span className="textColor font-semibold pl-1">
//                 {rate ? (rateData.original * parseFloat(rate)).toFixed(2) : 'Loading...'}
//             </span>
//         </p>
//     </div>

//     <div className="absolute top-[54%] right-4 text-black text-sm md:text-sm font-semibold pr-2">
//         Dollar Rate : <span className="textColor">Rs {rate !== null ? Math.round(parseFloat(rate)) : 'N/A '}</span>
//     </div>

//     <div className="absolute top-6 right-4 flex items-center justify-center gap-2">
//         <div className="text-left leading-none">
//             <div className="text-base font-semibold underline inline-flex text-black items-center gap-1">
//                 <ChevronDown className="w-3 h-3" />
//                 {active === 'docs' ? 'DOCs' : 'PKG'}
//             </div>
//             <div className="text-xs text-gray-500 uppercase underline pl-4">{selectedCountry}</div>
//         </div>
//         <div className="w-10 h-10 rounded-[10px] border-2 py-1 border-gray-500 flex items-center justify-center">
//             {active === 'docs' ? <IoDocumentsOutline className="text-black w-5 h-5" /> : <LuPackage className="text-black w-5 h-5" />}
//         </div>
//     </div>
// </div>

// <div className="relative w-full max-w-md my-1  z-40">
//     <div className="absolute left-1/2 -translate-x-1/2 -top-5 z-10  bg-[#e9e6e6] p-[1.5px] rounded-full ">
//         <div
//             className="w-10 h-10 rounded-full bg-white  border flex items-center justify-center shadow-sm cursor-pointer"
//             onClick={() => window.location.reload()}
//         >
//             <span className="text-gray-700 font-semibold hover:text-[#ff6b35] transition-transform duration-1000 hover:rotate-[750deg] transform-gpu">
//                 <RxReload className="w-5 h-5" />
//             </span>
//         </div>
//     </div>
// </div>
// < div className="bg-white px-6 pt-7 pb-4  w-full max-w-md rounded-[30px] shadow-xl space-y-2 relative  z-30">

//     {rateData.discounted !== null &&
//         rateData.discounted > 0 ? (
//         <div>

//             <div className="w-full">

//                 <p className="text-xl pb-2 font-semibold textColor">Discounted Rates</p>
//                 <p className="text-base py-1 text-black underline">Rates In Dollar $</p>
//                 <div className="text-4xl font-bold textColor tracking-tight border-b-2 border-gray-400 ">
//                     {rateData.discounted.toFixed(2)}
//                 </div>
//             </div>

//             <div className="flex items-start justify-between font-semibold text-xl gap-2 relative pt-2 text-black flex-col sm:flex-row">
//                 <p className="text-2xl font-normal text-black">In Rs :
//                     <span className="textColor font-semibold pl-1">
//                         {(rateData.discounted * Number(rate)).toFixed(2)}
//                     </span>
//                 </p>
//                 <div className="sm:absolute sm:-top-8 sm:right-2 flex flex-col  justify-center text-left gap-0">
//                     <p className="text-lg border-gray-400 font-semibold">Save $: <span className="textColor pl-1">{rateData.discountDollar.toFixed(2)}</span></p>
//                     <p className="text-lg font-semibold">Save Rs: <span className="textColor pl-1">
//                         {(rateData.discountDollar * Number(rate)).toFixed(2)}
//                     </span></p>
//                 </div>
//             </div>

//             <div className="absolute top-6 right-4 flex items-center gap-2">
//                 <div className="text-left leading-none">
//                     <div className="text-base font-semibold underline text-black inline-flex items-center gap-1">
//                         <ChevronDown className="w-3 h-3" />
//                         {active === 'docs' ? 'DOCs' : 'PKG'}
//                     </div>
//                     <div className="text-xs text-gray-600 uppercase underline pl-4">{selectedCountry}</div>
//                 </div>
//                 <div className="w-10 h-10 rounded-[10px] border-2 py-1 border-gray-500 flex items-center justify-center">
//                     {active === 'docs' ? <IoDocumentsOutline className="text-black w-5 h-5" /> : <LuPackage className="text-black w-5 h-5" />}
//                 </div>
//             </div>

//             <div className="flex items-center justify-center pt-4">
//                 <button className="px-4 py-3 bg-[#ff6b35] shadow-lg shadow-[#ff6b358e] hover:shadow-[#59595c] text-white rounded-lg font-semibold text-sm hover:bg-[#59595c] duration-500 transition">
//                     Exchange Now
//                 </button>
//             </div>
//         </div>

//     ) : (
//         <div className="text-xl text-center font-semibold textColor py-4">

//             {selectedCountry && selectedWeight
//                 ? 'Sorry! No deals found for your combination.'
//                 : '! Please enter the required fields.'}
//         </div>
//     )}
// </div>

// </div>