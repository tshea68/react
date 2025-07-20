import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const App = () => {
  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [popupImage, setPopupImage] = useState(null);
  const [pricedFilter, setPricedFilter] = useState("");
  const [allFilter, setAllFilter] = useState("");
  const [query, setQuery] = useState("");
  const [advancedQuery, setAdvancedQuery] = useState("");
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [error, setError] = useState(null);
  const API_BASE = import.meta.env.VITE_API_URL;

  const modelNumber = new URLSearchParams(window.location.search).get("model") || "";
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !searchRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (modelNum) => {
    setShowDropdown(false);
    setModelSuggestions([]);
    setPartSuggestions([]);
    setQuery(modelNum);
    if (modelNum !== modelNumber) {
      window.location.href = `?model=${encodeURIComponent(modelNum)}`;
    }
  };

  useEffect(() => {
    if (!modelNumber) return;
    setQuery(modelNumber);
    (async () => {
      try {
        setLoadingParts(true);
        setError(null);

        const searchRes = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(modelNumber)}`);
        const modelData = searchRes.ok ? await searchRes.json() : null;
        if (!searchRes.ok || !modelData?.model_number) {
          setModel(null);
          setError("Model not found.");
          return;
        }

        const partsRes = await fetch(`${API_BASE}/api/parts/for-model/${modelNumber}`);
        const partsData = partsRes.ok ? await partsRes.json() : { parts: [] };

        const allParts = (partsData.parts || []).filter((p) => p && p.mpn);
        const priced = allParts.filter(p => p.price != null);

        const sortedAllParts = allParts.sort((a, b) => {
          const aSeq = a.sequence_number ?? "";
          const bSeq = b.sequence_number ?? "";
          return (aSeq === "" ? -1 : bSeq === "" ? 1 : aSeq.localeCompare(bSeq));
        });

        setParts({ priced, all: sortedAllParts });
        setModel({ ...modelData, total_parts: sortedAllParts.length, priced_parts: priced.length });
      } catch (err) {
        console.error("❌ Error loading model or parts", err);
        setModel(null);
        setError("Error loading model data.");
      } finally {
        setLoadingParts(false);
      }
    })();
  }, [modelNumber]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.trim().length >= 2) {
        if (!modelNumber || query !== modelNumber) {
          setShowDropdown(true);
        }
        Promise.all([
          fetch(`${API_BASE}/api/suggest?q=${encodeURIComponent(query)}`),
          fetch(`${API_BASE}/api/suggest/parts?q=${encodeURIComponent(query)}`),
        ])
          .then(async ([modelsRes, partsRes]) => {
            const models = modelsRes.ok ? await modelsRes.json() : [];
            const parts = partsRes.ok ? await partsRes.json() : [];
            setModelSuggestions(models.slice(0, 5));
            setPartSuggestions(parts.slice(0, 5));
          })
          .catch(() => {
            setModelSuggestions([]);
            setPartSuggestions([]);
          });
      } else {
        setModelSuggestions([]);
        setPartSuggestions([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, modelNumber]);

  return <div className="p-6">Your UI rendering logic remains unchanged</div>;
};

export default App;






















