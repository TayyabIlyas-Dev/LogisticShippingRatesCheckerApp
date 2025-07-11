"use client";

import { useState } from "react";
import Link from "next/link";
import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton, SignOutButton } from "@clerk/nextjs";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 w-full backdrop-blur-[6px]  shadow-sm  z-50">
      <div className=" mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex  justify-between sm:justify-evenly h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center text-xl font-bold textColor">
            <Link href={'/'}> M&p Intl Rates</Link>
          </div>



          <div className="hidden md:flex justify-center font-medium md:items-center space-x-5">
            <Link href="#about" className="text-gray-700 hover:text-orange-400">About</Link>
            <Link href="#services" className="text-gray-700 hover:text-orange-400">Services</Link>
            <Link href="#contact" className="text-gray-700 hover:text-orange-400">Contact</Link>

          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex md:items-center space-x-4">


            <SignedOut>
              <SignInButton>
                <button
                  className="px-4 py-1.5 rounded-full font-semibold text-white bg-[#f97316] hover:bg-[#59595c] duration-500 transition"
                >Sign In</button>
              </SignInButton>

            </SignedOut>

            <SignedIn>
              <SignOutButton>
                <button
                  className="px-4 py-1.5 rounded-full font-semibold text-white bg-[#f97316] hover:bg-[#59595c] duration-500 transition"
                >Sign Out</button>
              </SignOutButton>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>

          {/* Mobile Hamburger */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-600  focus:outline-none"
            >
              <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden px-4 pb-4 space-y-4">
          <Link href="/about" className="block text-gray-700 hover:text-orange-500">About</Link>
          <Link href="/services" className="block text-gray-700 hover:text-orange-500">Services</Link>
          <Link href="/contact" className="block text-gray-700 hover:text-orange-500">Contact</Link>

          <SignedOut>
            <SignInButton>
              <button className="w-full px-3 py-2 rounded-3xl bg-[#f97316] text-white  hover:bg-[#59595c] duration-500 transition">Sign In</button>
            </SignInButton>
    
          </SignedOut>

          <SignedIn>
            <div className="flex items-center space-x-2">
              <UserButton afterSignOutUrl="/" />
              <SignOutButton>
                <button className="px-3 py-2 rounded-3xl bg-[#f97316] text-white  hover:bg-[#59595c] duration-500 transition">Sign Out</button>
              </SignOutButton>
            </div>
          </SignedIn>
        </div>
      )}
    </nav>
  );
}
