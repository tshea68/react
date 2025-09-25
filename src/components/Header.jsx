return (
  <header className="sticky top-0 z-50 bg-[#001F3F] text-white shadow">
    <div className="w-full px-4 md:px-6 lg:px-10 py-3 grid grid-cols-12 gap-3">
      {/* Logo column spans both rows */}
      <div className="col-span-4 md:col-span-3 lg:col-span-2 row-span-2 self-stretch flex items-center">
        <Link to="/" className="block h-full flex items-center">
          <img
            src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/output-onlinepngtools-3.webp"
            alt="Logo"
            className="h-12 md:h-[72px] lg:h-[84px] object-contain"
          />
        </Link>
      </div>

      {/* Row 1 (right side): Menu bar */}
      <div className="col-span-8 md:col-span-9 lg:col-span-10 flex items-center justify-end">
        <HeaderMenu />
      </div>

      {/* Row 2 (right side): Full-width search bar */}
      <div
        className="col-span-12 md:col-start-4 md:col-span-9 lg:col-start-3 lg:col-span-10 relative"
        ref={searchRef}
      >
        <input
          type="text"
          placeholder="Enter model or part number here"
          className="block w-full border-4 border-yellow-400 px-3 py-2 rounded text-black text-sm md:text-base lg:text-lg font-medium"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) setShowDropdown(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              openPart(query.trim());
            }
            if (e.key === "Escape") {
              setShowDropdown(false);
            }
          }}
        />

        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 bg-white text-black border rounded shadow mt-2 p-4 z-20"
          >
            {(loadingModels || loadingParts || loadingRefurb) && (
              <div className="text-gray-600 text-sm flex items-center mb-4 gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    fill="currentColor"
                  />
                </svg>
                Searching...
              </div>
            )}

            {/* Keep your 3-column content exactly as before */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Models column (unchanged) */}
              {/* ... your existing Models list JSX ... */}

              {/* Parts column with compare badge (unchanged) */}
              {/* ... your existing Parts list JSX ... */}

              {/* Refurb column (unchanged) */}
              {/* ... your existing Refurb list JSX ... */}
            </div>
          </div>
        )}
      </div>
    </div>
  </header>
);

