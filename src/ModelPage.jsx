function RefurbCard({
  normKey,
  knownName,
  cmp,
  newPart,
  modelNumber,
  sequence,
  allKnown,
}) {
  const refurb = getRefurb(cmp) || {};
  const refurbPrice = numericPrice(refurb);
  if (refurbPrice == null) return null;

  const refurbImgRaw =
    refurb.image_url ||
    refurb.image ||
    refurb.picture ||
    refurb.thumbnail ||
    refurb.main_image ||
    refurb.mainImage ||
    refurb.imageUrl ||
    (Array.isArray(refurb.images) ? refurb.images[0] : null) ||
    (Array.isArray(refurb.pictures) ? refurb.pictures[0] : null);

  const refurbImg = refurbImgRaw || "/no-image.png";

  const refurbMpn = refurb?.mpn || normKey.toUpperCase();

  // Use shared title helper with MPN-first
  const basePartForTitle = newPart || refurb;
  const baseTitle = makePartTitle(basePartForTitle, refurbMpn);
  const titleText = baseTitle || knownName || normKey.toUpperCase();

  const rawMpnForUrl =
    (newPart && extractRawMPN(newPart)) || refurbMpn || normKey;

  const offerId =
    refurb?.listing_id || refurb?.offer_id || refurb?.id || null;
  const offerQS = offerId
    ? `?offer=${encodeURIComponent(String(offerId))}`
    : "";

  const hasNewPart = !!newPart;
  const newFromCmp = getNew(cmp);
  const newPrice = hasNewPart
    ? numericPrice(newPart)
    : newFromCmp
    ? numericPrice(newFromCmp)
    : null;

  const savings = calcSavings(newPrice, refurbPrice);

  const rawNorm = normalize(rawMpnForUrl);
  let seq =
    sequence ??
    newPart?.sequence ??
    (allKnown || []).find(
      (r) => normalize(extractRawMPN(r)) === rawNorm
    )?.sequence ??
    null;

  return (
    <div className="relative border border-red-300 rounded p-3 hover:shadow-md transition bg-red-50">
      {seq != null && (
        <div className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-red-700 text-white">
          Diagram #{seq}
        </div>
      )}
      <div className="flex gap-4 items-start">
        <Link
          to={`/refurb/${encodeURIComponent(rawMpnForUrl)}${offerQS}`}
          state={{ fromModel: modelNumber }}
          className="group w-20 h-20 rounded bg-white flex items-center justify-center overflow-hidden border border-red-100 cursor-zoom-in"
        >
          <PartImage
            imageUrl={refurbImg}
            alt={titleText}
            className="w-full h-full object-contain transition-transform duration-150 ease-out group-hover:scale-110"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to={`/refurb/${encodeURIComponent(rawMpnForUrl)}${offerQS}`}
            state={{ fromModel: modelNumber }}
            className="font-semibold text-[15px] hover:underline line-clamp-2 text-black"
          >
            {titleText}
          </Link>

          <div className="mt-0.5 text-[13px] text-gray-800 flex items-center gap-2">
            <span>MPN: {refurbMpn}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-600 text-white">
              Refurbished
            </span>
          </div>

          {seq != null && (
            <div className="text-[11px] text-gray-700 mt-0.5">
              Diagram #{seq}
            </div>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
              In stock
            </span>
            <span className="font-semibold">
              {formatPrice(refurbPrice)}
            </span>
            {savings != null && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                Save {formatPrice(savings)} vs new
              </span>
            )}
          </div>

          {savings != null || newPrice != null ? (
            <div className="mt-2 text-xs text-red-700 bg-white border border-red-200 rounded px-2 py-1">
              {newPrice != null
                ? `New part available for ${formatPrice(newPrice)}`
                : "No new part available for comparison."}
              {savings != null ? (
                <span className="ml-2 font-semibold">
                  Save {formatPrice(savings)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
