// src/components/HeaderMenu.jsx
import React from "react";
import { Truck, Search, Undo2, Repeat } from "lucide-react";

const HeaderMenu = () => {
  return (
    <nav className="hidden md:flex flex-col justify-end pb-2">
      {/* font size reduced */}
      <div className="flex justify-center space-x-10 text-sm md:text-base font-semibold text-white relative z-40 pb-2">
        {/* Rare Part Request */}
        <div className="group relative inline-block">
          <button className="flex items-center gap-2">
            <Search className="w-5 h-5" /> Rare Part Request
          </button>
          <div className="fixed left-1/2 -translate-x-1/2 top-[5rem] pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 transform group-hover:translate-y-2 group-hover:-translate-y-0 transition-all duration-600 ease-in-out group-hover:flex flex-row gap-6 bg-white text-black border p-4 w-[64rem] z-50 max-h-[36rem] overflow-y-auto text-sm shadow-lg">
            {/* ...unchanged content... */}
          </div>
        </div>

        {/* We Ship Same Day */}
        <div className="group relative inline-block">
          <button className="flex items-center gap-2">
            <Truck className="w-5 h-5" /> We Ship Same Day
          </button>
          <div className="fixed left-1/2 -translate-x-1/2 top-[5rem] pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 transform group-hover:translate-y-2 group-hover:-translate-y-0 transition-all duration-600 ease-in-out group-hover:flex flex-row gap-6 bg-white text-black border p-4 w-[64rem] z-50 max-h-[36rem] overflow-y-auto text-sm shadow-lg">
            {/* ...unchanged content... */}
          </div>
        </div>

        {/* Return Policy */}
        <div className="group relative inline-block">
          <button className="flex items-center gap-2">
            <Undo2 className="w-5 h-5" /> Return Policy
          </button>
          <div className="fixed left-1/2 -translate-x-1/2 top-[5rem] pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 transform group-hover:translate-y-2 group-hover:-translate-y-0 transition-all duration-600 ease-in-out group-hover:flex flex-row gap-6 bg-white text-black border p-4 w-[64rem] z-50 max-h-[36rem] overflow-y-auto text-sm shadow-lg">
            {/* ...unchanged content... */}
          </div>
        </div>

        {/* Changing Orders */}
        <div className="group relative inline-block">
          <button className="flex items-center gap-2">
            <Repeat className="w-5 h-5" /> Changing Orders
          </button>
          <div className="fixed left-1/2 -translate-x-1/2 top-[5rem] pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 transform group-hover:translate-y-2 group-hover:-translate-y-0 transition-all duration-600 ease-in-out group-hover:flex flex-row gap-6 bg-white text-black border p-4 w-[64rem] z-50 max-h-[36rem] overflow-y-auto text-sm shadow-lg">
            {/* ...unchanged content... */}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default HeaderMenu;
