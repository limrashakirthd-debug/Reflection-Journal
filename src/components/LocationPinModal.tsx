import React, { useState, useEffect } from 'react';
import {
  MapPin,
  X,
  Navigation,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Info,
  Check,
  Globe,
  Compass,
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { JournalLocation } from '../types';

interface LocationPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation?: JournalLocation | null;
  onSaveLocation: (location: JournalLocation) => Promise<void>;
  onRemoveLocation?: () => Promise<void>;
  isSaving?: boolean;
}

const PRESET_SANCTUARIES: Array<{ name: string; address: string; lat: number; lng: number }> = [
  {
    name: 'Arashiyama Bamboo Grove',
    address: 'Kyoto, Japan',
    lat: 35.017,
    lng: 135.671,
  },
  {
    name: 'Central Park Conservatory Water',
    address: 'New York, NY, USA',
    lat: 40.7744,
    lng: -73.9688,
  },
  {
    name: 'Big Sur Bixby Bridge Overlook',
    address: 'California, USA',
    lat: 36.3714,
    lng: -121.9018,
  },
  {
    name: 'Lake Como Lakeside Promenade',
    address: 'Bellagio, Lombardy, Italy',
    lat: 45.9873,
    lng: 9.2625,
  },
  {
    name: 'Quiet Coffee Haven',
    address: 'Local Sanctuary',
    lat: 37.7749,
    lng: -122.4194,
  },
];

export function LocationPinModal({
  isOpen,
  onClose,
  currentLocation,
  onSaveLocation,
  onRemoveLocation,
  isSaving = false,
}: LocationPinModalProps) {
  const [name, setName] = useState(currentLocation?.name || '');
  const [address, setAddress] = useState(currentLocation?.address || '');
  const [lat, setLat] = useState<number>(currentLocation?.lat ?? 35.017);
  const [lng, setLng] = useState<number>(currentLocation?.lng ?? 135.671);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showDirectiveGuide, setShowDirectiveGuide] = useState(false);

  // Client-side environment API key
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // Synchronize with incoming location prop
  useEffect(() => {
    if (isOpen) {
      setName(currentLocation?.name || '');
      setAddress(currentLocation?.address || '');
      setLat(currentLocation?.lat ?? 35.017);
      setLng(currentLocation?.lng ?? 135.671);
      setLocationError(null);
    }
  }, [isOpen, currentLocation]);

  if (!isOpen) return null;

  // Fetch device geolocation with graceful degradation
  const handleGetDeviceLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const deviceLat = Number(position.coords.latitude.toFixed(5));
        const deviceLng = Number(position.coords.longitude.toFixed(5));
        setLat(deviceLat);
        setLng(deviceLng);
        if (!name) {
          setName('Current Location');
        }

        // Try reverse geocoding via secure backend proxy
        try {
          const res = await fetch(`/api/maps/geocode?lat=${deviceLat}&lng=${deviceLng}`);
          if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
              setAddress(data.results[0].formatted_address);
              if (!name || name === 'Current Location') {
                setName(data.results[0].formatted_address.split(',')[0]);
              }
            }
          }
        } catch {
          // Non-blocking fallback
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location access was denied. You can select coordinates manually below.');
        } else {
          setLocationError('Unable to determine location. Please choose a preset or set coordinates.');
        }
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  const handleSelectPreset = (preset: typeof PRESET_SANCTUARIES[0]) => {
    setName(preset.name);
    setAddress(preset.address);
    setLat(preset.lat);
    setLng(preset.lng);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setLocationError('Please provide a name for this location.');
      return;
    }

    await onSaveLocation({
      name: name.trim(),
      address: address.trim() || undefined,
      lat,
      lng,
      placeId: currentLocation?.placeId,
    });
    onClose();
  };

  const handleRemove = async () => {
    if (onRemoveLocation) {
      await onRemoveLocation();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#ffffff] dark:bg-[#1e1c19] border border-[#e5e4de] dark:border-[#36332e] rounded-2xl shadow-xl max-w-xl w-full my-8 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#eee8df] dark:border-[#2d2b27] flex items-center justify-between bg-[#faf7f2] dark:bg-[#23201c]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#f0e8dc] dark:bg-[#382f25] text-[#8c5b3e] dark:text-[#deb887] flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-serif font-semibold text-[#2d2d2a] dark:text-[#edece6]">
                {currentLocation ? 'Edit Pinned Location' : 'Pin a Location'}
              </h2>
              <p className="text-xs text-[#73726c] dark:text-[#a09c94]">
                Anchor this reflection to a place, sanctuary, or memory
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowDirectiveGuide(!showDirectiveGuide)}
              className="px-2.5 py-1 text-xs rounded-lg text-[#8c5b3e] dark:text-[#deb887] hover:bg-[#ebdccc] dark:hover:bg-[#382f25] transition-colors flex items-center gap-1"
              title="Google Maps Security Directives & Setup"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Security Directive</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#73726c] dark:text-[#a09c94] hover:bg-[#eee8df] dark:hover:bg-[#2d2b27] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Google Maps Directive & Key Setup Guide Drawer */}
        {showDirectiveGuide && (
          <div className="p-4 bg-[#f8f6f0] dark:bg-[#282520] border-b border-[#e8e2d8] dark:border-[#38332b] text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#8c5b3e] dark:text-[#deb887] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Google Maps Platform Secure Interaction Directive
              </span>
              <button
                onClick={() => setShowDirectiveGuide(false)}
                className="text-[#73726c] hover:text-[#2d2d2a] dark:hover:text-[#edece6]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[#595852] dark:text-[#b5b1a6] leading-relaxed">
              This app enforces the <strong>Google Maps Platform Secure Interaction Directive</strong>:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[#595852] dark:text-[#b5b1a6]">
              <li>
                <strong>Zero Hardcoded Keys:</strong> Keys are never hardcoded. Loaded via{' '}
                <code className="px-1 py-0.5 rounded bg-[#ebdccc] dark:bg-[#382f25] text-[11px]">
                  VITE_GOOGLE_MAPS_API_KEY
                </code>
                .
              </li>
              <li>
                <strong>Maps Demo Key for Prototyping:</strong> Use the free, zero-billing Maps Demo Key at{' '}
                <a
                  href="https://mapsplatform.google.com/maps-demo-key"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8c5b3e] dark:text-[#deb887] underline inline-flex items-center gap-0.5"
                >
                  mapsplatform.google.com/maps-demo-key <ExternalLink className="w-2.5 h-2.5" />
                </a>
                .
              </li>
              <li>
                <strong>Production Restrictions:</strong> Restrict keys to HTTP referrers (
                <code className="text-[11px]">https://*.run.app/*</code>) and enabled APIs (Maps JavaScript, Places, Geocoding).
              </li>
              <li>
                <strong>User Privacy:</strong> Pinned coordinates and place names are stored exclusively in owner-isolated Firestore paths (<code className="text-[11px]">/users/{'{userId}'}/interactions</code>).
              </li>
              <li>
                <strong>Modern Architecture:</strong> Built with <code className="text-[11px]">@vis.gl/react-google-maps</code>, AdvancedMarker, and resilient fallback when keys are not configured.
              </li>
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Interactive Map or Visual Fallback Canvas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#595852] dark:text-[#b5b1a6] flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#8c5b3e] dark:text-[#deb887]" />
                Interactive Map Location
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGetDeviceLocation}
                  disabled={isLocating}
                  className="text-xs text-[#8c5b3e] dark:text-[#deb887] hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <Navigation className="w-3 h-3" />
                  {isLocating ? 'Locating...' : 'Use My GPS'}
                </button>
              </div>
            </div>

            {/* Google Maps SDK or Cartographic Coordinate Fallback */}
            {googleMapsApiKey ? (
              <div className="h-56 w-full rounded-xl overflow-hidden border border-[#e5e4de] dark:border-[#36332e] relative shadow-inner">
                <APIProvider apiKey={googleMapsApiKey}>
                  <Map
                    defaultCenter={{ lat, lng }}
                    center={{ lat, lng }}
                    defaultZoom={13}
                    mapId="DEMO_MAP_ID"
                    gestureHandling="cooperative"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    onClick={(e) => {
                      if (e.detail?.latLng) {
                        setLat(Number(e.detail.latLng.lat.toFixed(5)));
                        setLng(Number(e.detail.latLng.lng.toFixed(5)));
                      }
                    }}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <AdvancedMarker position={{ lat, lng }} title={name || 'Pinned Location'}>
                      <div className="bg-[#8c5b3e] text-white p-2 rounded-full shadow-lg border-2 border-white dark:border-[#1e1c19] flex items-center justify-center transform hover:scale-110 transition-transform">
                        <MapPin className="w-4 h-4 fill-white" />
                      </div>
                    </AdvancedMarker>
                  </Map>
                </APIProvider>
              </div>
            ) : (
              /* Resilient Fallback: Cartographic coordinate canvas when no API key is set */
              <div className="h-52 w-full rounded-xl bg-[#f4ede4] dark:bg-[#25211c] border border-[#e8ded1] dark:border-[#3b342b] p-4 flex flex-col justify-between relative overflow-hidden">
                {/* Background gridlines for subtle map feel */}
                <div
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage:
                      'radial-gradient(#8c5b3e 1px, transparent 1px), radial-gradient(#8c5b3e 1px, #f4ede4 1px)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 10px 10px',
                  }}
                />

                <div className="relative z-10 flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8c5b3e] dark:text-[#deb887] flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5" />
                      Cartographic Coordinate Pin
                    </span>
                    <p className="text-xs text-[#73726c] dark:text-[#a09c94]">
                      Latitude: {lat.toFixed(4)}°, Longitude: {lng.toFixed(4)}°
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDirectiveGuide(true)}
                    className="text-[11px] px-2 py-1 rounded bg-[#ebdccc] dark:bg-[#382f25] text-[#8c5b3e] dark:text-[#deb887] hover:bg-[#e0cfbe] transition-colors flex items-center gap-1"
                  >
                    <Info className="w-3 h-3" />
                    Maps Demo Key Guide
                  </button>
                </div>

                <div className="relative z-10 flex flex-col items-center justify-center py-2 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#8c5b3e] text-white flex items-center justify-center shadow-md mb-1 animate-bounce">
                    <MapPin className="w-5 h-5 fill-white" />
                  </div>
                  <div className="text-xs font-medium text-[#2d2d2a] dark:text-[#edece6]">
                    {name || 'Selected Coordinate Point'}
                  </div>
                  <div className="text-[11px] text-[#73726c] dark:text-[#a09c94] truncate max-w-sm">
                    {address || 'Pinned to your journal entry'}
                  </div>
                </div>

                <div className="relative z-10 text-[11px] text-[#888780] dark:text-[#958f84] text-center border-t border-[#e2d8ca] dark:border-[#383228] pt-2">
                  Tip: Provide coordinates or choose a preset sanctuary below to pin.
                </div>
              </div>
            )}
          </div>

          {/* Preset Sanctuaries */}
          <div>
            <span className="text-[11px] font-medium text-[#73726c] dark:text-[#a09c94] mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#8c5b3e] dark:text-[#deb887]" />
              Preset Sanctuaries & Inspirations:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_SANCTUARIES.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="px-2.5 py-1 text-xs rounded-full border border-[#e5e4de] dark:border-[#36332e] bg-[#faf7f2] dark:bg-[#23201c] hover:border-[#8c5b3e] hover:text-[#8c5b3e] dark:hover:border-[#deb887] dark:hover:text-[#deb887] text-[#595852] dark:text-[#b5b1a6] transition-colors"
                >
                  {preset.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields: Name & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#595852] dark:text-[#b5b1a6] mb-1">
                Location Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kyoto Bamboo Grove"
                required
                maxLength={80}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#e5e4de] dark:border-[#36332e] bg-[#faf7f2] dark:bg-[#23201c] text-[#2d2d2a] dark:text-[#edece6] focus:outline-hidden focus:ring-1 focus:ring-[#8c5b3e]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#595852] dark:text-[#b5b1a6] mb-1">
                City / Region / Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Kyoto, Japan"
                maxLength={120}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#e5e4de] dark:border-[#36332e] bg-[#faf7f2] dark:bg-[#23201c] text-[#2d2d2a] dark:text-[#edece6] focus:outline-hidden focus:ring-1 focus:ring-[#8c5b3e]"
              />
            </div>
          </div>

          {/* Coordinates Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#73726c] dark:text-[#a09c94] mb-1">
                Latitude (-90 to 90)
              </label>
              <input
                type="number"
                step="0.0001"
                min="-90"
                max="90"
                value={lat}
                onChange={(e) => setLat(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#e5e4de] dark:border-[#36332e] bg-[#faf7f2] dark:bg-[#23201c] text-[#2d2d2a] dark:text-[#edece6]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#73726c] dark:text-[#a09c94] mb-1">
                Longitude (-180 to 180)
              </label>
              <input
                type="number"
                step="0.0001"
                min="-180"
                max="180"
                value={lng}
                onChange={(e) => setLng(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#e5e4de] dark:border-[#36332e] bg-[#faf7f2] dark:bg-[#23201c] text-[#2d2d2a] dark:text-[#edece6]"
              />
            </div>
          </div>

          {locationError && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-xl border border-red-200 dark:border-red-900/50">
              {locationError}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 border-t border-[#eee8df] dark:border-[#2d2b27] flex items-center justify-between">
            {currentLocation && onRemoveLocation ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
              >
                Remove Pin
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs text-[#73726c] dark:text-[#a09c94] hover:bg-[#eee8df] dark:hover:bg-[#2d2b27] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-1.5 text-xs font-medium rounded-xl bg-[#2d2d2a] dark:bg-[#deb887] text-[#f8f7f2] dark:text-[#161514] hover:bg-[#43423e] dark:hover:bg-[#cb9b69] transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : currentLocation ? 'Update Location' : 'Pin to Journal'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
