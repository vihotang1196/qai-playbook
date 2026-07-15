import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  getLocationIdFromUrl,
  isCustomerView as detectCustomerView,
  isEmbed as detectEmbed,
  fetchLocation,
  type GhlLocation,
} from "@/lib/ghl";

/**
 * Current GHL location context for the Review Boost admin.
 *
 * - Customer/sub-account view (embedded from GHL, URL has a location_id):
 *   resolves the location via the `ghl` edge function.
 * - Agency view (root, no location_id): no location; the picker arrives in
 *   Phase 3 once the GHL sync populates locations.
 */
type LocationContextValue = {
  locationId: string;
  location: GhlLocation | null;
  isCustomerView: boolean;
  isEmbed: boolean;
  loading: boolean;
  error: string | null;
};

const Ctx = createContext<LocationContextValue>({
  locationId: "",
  location: null,
  isCustomerView: false,
  isEmbed: false,
  loading: false,
  error: null,
});

export function LocationProvider({ children }: { children: ReactNode }) {
  const routerLoc = useLocation();
  const locationId = getLocationIdFromUrl(routerLoc.pathname, routerLoc.search);
  const customerView = detectCustomerView(routerLoc.pathname, routerLoc.search);
  const embed = detectEmbed(routerLoc.search);

  const [location, setLocation] = useState<GhlLocation | null>(null);
  const [loading, setLoading] = useState<boolean>(customerView && !!locationId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!customerView || !locationId) {
      setLocation(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchLocation(locationId)
      .then((loc) => {
        if (cancelled) return;
        setLocation(loc);
        if (!loc) setError("Location not found");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load location");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationId, customerView]);

  return (
    <Ctx.Provider
      value={{ locationId, location, isCustomerView: customerView, isEmbed: embed, loading, error }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLocationContext() {
  return useContext(Ctx);
}
