  return (
    <section
      className="w-full min-h-screen text-black"
      style={{ backgroundColor: BG_BLUE }}
    >
      {/* full-width appliance category pills row */}
      <CategoryBar />

      {/* CONTENT WRAPPER:
         - max width
         - big white sheet like Reliable
         - contains BOTH sidebar + results
      */}
      <div className="mx-auto w-[min(1300px,96vw)] py-6">
        <div className="bg-white border border-gray-300 rounded-md shadow-sm text-black">
          {/* inner grid: sidebar + main results */}
          <div className="grid grid-cols-12 gap-6 p-4 md:p-6">
            {/* Sidebar */}
            <aside className="col-span-12 md:col-span-4 lg:col-span-3">
              <div className="border border-gray-300 rounded-md overflow-hidden text-black">
                {/* SHOP BY header */}
                <div
                  className="font-semibold px-4 py-2 text-sm"
                  style={{ backgroundColor: SHOP_BAR, color: "black" }}
                >
                  SHOP BY
                </div>

                {/* Model / Part # */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <label className="block text-[11px] font-semibold text-black uppercase tracking-wide mb-1">
                    Model or Part #
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your model or part number"
                    className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />

                  {/* checkboxes */}
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm text-black">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                      />
                      <span>In stock only</span>
                    </label>

                    <label className="flex items-center gap-2 text-sm text-black">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={includeRefurb}
                        onChange={(e) => setIncludeRefurb(e.target.checked)}
                      />
                      <span>Include refurbished</span>
                    </label>
                  </div>
                </div>

                {/* Brands */}
                <FacetList
                  title="Brands"
                  values={brandOpts}
                  selectedValue={brand}
                  onSelect={(val) => setBrand(val)}
                  showAll={showAllBrands}
                  setShowAll={setShowAllBrands}
                />

                {/* Part Type */}
                <FacetList
                  title="Part Type"
                  values={partOpts}
                  selectedValue={partType}
                  onSelect={(val) => setPartType(val)}
                  showAll={showAllParts}
                  setShowAll={setShowAllParts}
                />

                {/* Sort */}
                <div className="px-4 py-3 text-black">
                  <div className="font-semibold text-black mb-1 text-sm">
                    Sort By
                  </div>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black"
                  >
                    <option value="availability_desc,price_asc">
                      Best availability / Popular
                    </option>
                    <option value="price_asc">Price: Low → High</option>
                    <option value="price_desc">Price: High → Low</option>
                  </select>
                </div>
              </div>
            </aside>

            {/* Main results */}
            <main className="col-span-12 md:col-span-8 lg:col-span-9">
              <div className="border border-gray-300 rounded-md shadow-sm text-black bg-white">
                {/* Heading / toolbar */}
                <div className="px-4 pt-4 pb-2 border-b border-gray-200">
                  <div className="text-xl font-semibold text-black">
                    {applianceType ? `${applianceType} Parts` : "Parts Results"}
                  </div>

                  <div className="mt-1 text-[13px] text-gray-700 leading-snug">
                    Find genuine OEM and refurbished parts from top brands.
                    Check availability and add to cart. Fast shipping.
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-gray-700">
                    <div className="font-semibold">
                      {`Items 1-${rows.length} of ${totalCount}`}
                    </div>

                    <div className="flex items-center gap-1">
                      <span>Show</span>
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-[13px] text-black"
                        value={PER_PAGE}
                        onChange={() => {}}
                      >
                        <option value={10}>10</option>
                        <option value={30}>30</option>
                        <option value={60}>60</option>
                      </select>
                      <span>per page</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span>Sort By</span>
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-[13px] text-black"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="availability_desc,price_asc">
                          Most Popular
                        </option>
                        <option value="price_asc">Price: Low → High</option>
                        <option value="price_desc">Price: High → Low</option>
                      </select>
                    </div>

                    {loading && (
                      <span className="ml-auto inline-flex items-center gap-2 text-gray-600 text-[13px]">
                        <span className="animate-spin">⏳</span> Loading…
                      </span>
                    )}
                  </div>
                </div>

                {/* Results list */}
                <div className="p-4 space-y-4">
                  {errorMsg ? (
                    <div className="text-red-600 text-sm">{errorMsg}</div>
                  ) : rows.length === 0 && !loading ? (
                    <div className="text-sm text-gray-500">
                      No results. Try widening your filters.
                    </div>
                  ) : (
                    rows.map((p, i) => (
                      <PartRow
                        key={`${p.mpn_normalized || p.mpn || i}-${i}`}
                        p={p}
                      />
                    ))
                  )}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </section>
  );
