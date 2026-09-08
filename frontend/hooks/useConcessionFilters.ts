"use client";

import { useState, useEffect } from "react";

/**
 * Centralized filter state for concession lists.
 * `debouncedSearch` fires 350ms after the user stops typing to avoid
 * hammering the API on every keystroke.
 */
export function useConcessionFilters() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  return {
    search,
    setSearch,
    debouncedSearch,
    status,
    setStatus,
  };
}
