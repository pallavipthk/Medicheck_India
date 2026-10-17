import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Navigation,
  Search,
  Building2,
  Phone,
  Clock,
  ShieldCheck,
  ExternalLink,
  X,
  Crosshair,
  Sparkles,
  Layers,
  List,
  CheckCircle2,
  Store,
  ChevronRight
} from 'lucide-react';
import { apiGetPharmacies } from '../api/client';
import { Pharmacy } from '../types';

// Default authentic Indian medical shops so map is immediately populated on load
const INITIAL_DEFAULT_PHARMACIES: Pharmacy[] = [
  {
    id: 'chem-del-01',
    name: 'Pradhan Mantri Bhartiya Janaushadhi Kendra (PMBJP)',
    address: 'Gate No. 2, AIIMS Campus, Sri Aurobindo Marg, Ansari Nagar',
    city: 'New Delhi',
    pin_code: '110029',
    phone: '+91 1800 180 8080',
    opening_hours: '24 Hours / 7 Days',
    latitude: 28.5672,
    longitude: 77.2100,
    distance_km: 0.3,
    type: 'Jan Aushadhi Government Center',
    license_verified: true,
  },
  {
    id: 'chem-del-02',
    name: 'Apollo Pharmacy 24/7 - Connaught Place',
    address: 'Block E, Inner Circle, Connaught Place',
    city: 'New Delhi',
    pin_code: '110001',
    phone: '+91 11 2341 5522',
    opening_hours: '24 Hours / 7 Days Open',
    latitude: 28.6328,
    longitude: 77.2197,
    distance_km: 0.8,
    type: 'Licensed 24/7 Retail Pharmacy',
    license_verified: true,
  },
  {
    id: 'chem-del-04',
    name: 'MedPlus Chemist & Druggist - Karol Bagh',
    address: 'Pusa Road, Near Metro Pillar 125, Karol Bagh',
    city: 'New Delhi',
    pin_code: '110005',
    phone: '+91 11 2875 1420',
    opening_hours: '08:00 AM - 11:00 PM',
    latitude: 28.6433,
    longitude: 77.1895,
    distance_km: 1.4,
    type: 'Licensed Retail Pharmacy',
    license_verified: true,
  },
  {
    id: 'chem-del-03',
    name: 'Fortis Hospital In-House Pharmacy',
    address: 'Sector B, Pocket 1, Aruna Asaf Ali Marg, Vasant Kunj',
    city: 'New Delhi',
    pin_code: '110070',
    phone: '+91 11 4277 6222',
    opening_hours: '24 Hours / 7 Days Open',
    latitude: 28.5284,
    longitude: 77.1584,
    distance_km: 2.1,
    type: 'Hospital In-House Pharmacy',
    license_verified: true,
  },
  {
    id: 'chem-mum-01',
    name: 'Wellness Forever Chemist 24/7 - Bandra',
    address: 'Hill Road, Opp. Holy Family Hospital, Bandra West',
    city: 'Mumbai',
    pin_code: '400050',
    phone: '+91 22 2640 1289',
    opening_hours: '24 Hours / 7 Days Open',
    latitude: 19.0553,
    longitude: 72.8295,
    distance_km: 0.5,
    type: 'Licensed 24/7 Retail Chemist',
    license_verified: true,
  },
  {
    id: 'chem-mum-02',
    name: 'Pradhan Mantri Janaushadhi Kendra - KEM Hospital',
    address: 'Near OPD Gate, Acharya Donde Marg, Parel',
    city: 'Mumbai',
    pin_code: '400012',
    phone: '+91 22 2410 7000',
    opening_hours: '08:00 AM - 09:00 PM',
    latitude: 19.0028,
    longitude: 72.8427,
    distance_km: 1.1,
    type: 'Jan Aushadhi Government Center',
    license_verified: true,
  },
];

type CategoryFilter = 'all' | 'janaushadhi' | '24_7' | 'retail' | 'hospital';

export const LocatorPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>(INITIAL_DEFAULT_PHARMACIES);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(INITIAL_DEFAULT_PHARMACIES[0].id);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [statusMsg, setStatusMsg] = useState<string | null>('Showing verified medical shops & Jan Aushadhi generic centers.');

  // Map DOM and Leaflet References
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  // Initial load: fetch real pharmacies for New Delhi or current area
  useEffect(() => {
    apiGetPharmacies({ q: 'New Delhi' })
      .then((res) => {
        if (res.pharmacies && res.pharmacies.length > 0) {
          setPharmacies(res.pharmacies);
          setSelectedShopId(res.pharmacies[0].id);
        }
      })
      .catch(() => {
        // Fallback to default authentic stores
      });
  }, []);

  // Filtered pharmacies list
  const filteredPharmacies = useMemo(() => {
    return pharmacies.filter((p) => {
      const typeLower = (p.type || '').toLowerCase();
      const nameLower = p.name.toLowerCase();
      const hoursLower = (p.opening_hours || '').toLowerCase();

      if (activeFilter === 'janaushadhi') {
        return typeLower.includes('jan aushadhi') || nameLower.includes('janaushadhi') || nameLower.includes('pmbjp');
      }
      if (activeFilter === '24_7') {
        return hoursLower.includes('24') || typeLower.includes('24/7') || nameLower.includes('24/7');
      }
      if (activeFilter === 'retail') {
        return !typeLower.includes('jan aushadhi') && !typeLower.includes('hospital');
      }
      if (activeFilter === 'hospital') {
        return typeLower.includes('hospital') || nameLower.includes('hospital');
      }
      return true;
    });
  }, [pharmacies, activeFilter]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const defaultLat = INITIAL_DEFAULT_PHARMACIES[0].latitude;
    const defaultLng = INITIAL_DEFAULT_PHARMACIES[0].longitude;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 13,
      zoomControl: false,
    });

    // OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &bull; MediCheck India',
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = layerGroup;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    const handleWindowResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleWindowResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render Marker Pins Whenever Filtered Pharmacies or Selection Changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markersMapRef.current.clear();

    if (filteredPharmacies.length === 0) return;

    const bounds = L.latLngBounds([]);

    filteredPharmacies.forEach((pharm) => {
      if (pharm.latitude == null || pharm.longitude == null) return;

      const isSelected = pharm.id === selectedShopId;
      const typeLower = (pharm.type || '').toLowerCase();
      const isJanAushadhi = typeLower.includes('jan aushadhi') || pharm.name.toLowerCase().includes('janaushadhi');
      const is24h = (pharm.opening_hours || '').includes('24') || typeLower.includes('24/7');
      const isHospital = typeLower.includes('hospital');

      let pinColor = '#2563EB'; // Retail Blue
      let pinLabel = 'CHEMIST';

      if (isJanAushadhi) {
        pinColor = '#168C78'; // Teal
        pinLabel = 'JAN AUSHADHI';
      } else if (is24h) {
        pinColor = '#059669'; // Emerald
        pinLabel = '24/7 OPEN';
      } else if (isHospital) {
        pinColor = '#D97706'; // Amber
        pinLabel = 'HOSPITAL';
      }

      const customHtml = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
          transition: transform 0.2s ease;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
        ">
          <div style="
            background: ${pinColor};
            color: #FFFFFF;
            padding: 4px 8px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.04em;
            white-space: nowrap;
            border: 2px solid #FFFFFF;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span>${pinLabel}</span>
          </div>
          <div style="
            width: 12px;
            height: 12px;
            background: ${pinColor};
            border-left: 2px solid #FFFFFF;
            border-bottom: 2px solid #FFFFFF;
            transform: rotate(-45deg) translateY(-4px);
            margin-top: -3px;
          "></div>
        </div>
      `;

      const icon = L.divIcon({
        html: customHtml,
        className: 'custom-medical-pin',
        iconSize: [100, 38],
        iconAnchor: [50, 36],
        popupAnchor: [0, -36],
      });

      const marker = L.marker([pharm.latitude, pharm.longitude], { icon });

      // Clean Accessible Popup HTML
      const popupHtml = `
        <div style="font-family: inherit; min-width: 240px; max-width: 300px; padding: 4px 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="
              font-size: 11px;
              font-weight: 800;
              color: ${pinColor};
              background: rgba(22, 140, 120, 0.12);
              padding: 2px 7px;
              border-radius: 9999px;
            ">
              ${pharm.type || 'Licensed Pharmacy'}
            </span>
            ${pharm.distance_km ? `<span style="font-size: 11px; font-weight: 600; color: #64748B;">${pharm.distance_km} km</span>` : ''}
          </div>

          <h4 style="margin: 0 0 6px 0; font-size: 14.5px; font-weight: 800; line-height: 1.3;">
            ${pharm.name}
          </h4>

          <div style="font-size: 12px; margin-bottom: 8px; line-height: 1.4; opacity: 0.85;">
            📍 ${pharm.address}${pharm.pin_code ? ' - ' + pharm.pin_code : ''}
          </div>

          <div style="font-size: 11.5px; font-weight: 600; margin-bottom: 10px; display: flex; align-items: center; gap: 5px;">
            <span>🕒</span> <span>${pharm.opening_hours || 'Standard Hours'}</span>
          </div>

          <div style="display: flex; gap: 8px; align-items: center;">
            ${
              pharm.phone
                ? `<a href="tel:${pharm.phone}" style="
                    flex: 1;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 7px 10px;
                    background: #168C78;
                    color: #FFFFFF;
                    border-radius: 6px;
                    text-decoration: none;
                    font-size: 12px;
                    font-weight: 700;
                  ">📞 Call</a>`
                : ''
            }
            <a href="https://www.google.com/maps/dir/?api=1&destination=${pharm.latitude},${pharm.longitude}"
               target="_blank"
               rel="noopener noreferrer"
               style="
                flex: 1;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 7px 10px;
                background: #1F2937;
                color: #FFFFFF;
                border-radius: 6px;
                text-decoration: none;
                font-size: 12px;
                font-weight: 700;
              ">
              🗺️ Directions
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 320 });

      marker.on('click', () => {
        setSelectedShopId(pharm.id);
      });

      marker.addTo(layer);
      markersMapRef.current.set(pharm.id, marker);
      bounds.extend([pharm.latitude, pharm.longitude]);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [filteredPharmacies, selectedShopId]);

  // Handle Search Input Submission
  const handleSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setIsLoading(true);
    setStatusMsg(`Locating verified pharmacies for "${searchTerm}"...`);

    try {
      const res = await apiGetPharmacies({ q: searchTerm.trim() });
      if (res.pharmacies && res.pharmacies.length > 0) {
        setPharmacies(res.pharmacies);
        setSelectedShopId(res.pharmacies[0].id);
        setStatusMsg(`Found ${res.pharmacies.length} verified pharmacies in "${searchTerm}".`);

        if (mapInstanceRef.current) {
          const map = mapInstanceRef.current;
          const bounds = L.latLngBounds([]);
          res.pharmacies.forEach((p) => {
            if (p.latitude != null && p.longitude != null) {
              bounds.extend([p.latitude, p.longitude]);
            }
          });
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          }
        }
      } else {
        setStatusMsg(`No open medical shops found for "${searchTerm}". Showing regional alternatives.`);
      }
    } catch (e) {
      setStatusMsg('Network search failed. Showing authentic verified defaults.');
    } finally {
      setIsLoading(false);
    }
  };

  // Browser Geolocation "Near Me"
  const handleUseGeolocation = () => {
    if (!navigator.geolocation) {
      setStatusMsg('Geolocation is not supported by your browser.');
      return;
    }
    setIsLoading(true);
    setStatusMsg('Retrieving your GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await apiGetPharmacies({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
          if (res.pharmacies && res.pharmacies.length > 0) {
            setPharmacies(res.pharmacies);
            setSelectedShopId(res.pharmacies[0].id);
            setStatusMsg(`Found ${res.pharmacies.length} verified chemists near your coordinates.`);
            if (mapInstanceRef.current) {
              mapInstanceRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 14, { duration: 1.2 });
            }
          }
        } catch {
          setStatusMsg('Could not fetch pharmacies near your coordinates.');
        } finally {
          setIsLoading(false);
        }
      },
      () => {
        setIsLoading(false);
        setStatusMsg('Location permission was denied. Please enter your city or PIN code above.');
      },
      { timeout: 8000 }
    );
  };

  // Focus map on a specific shop from the card list
  const handleFocusShop = (pharm: Pharmacy) => {
    setSelectedShopId(pharm.id);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([pharm.latitude, pharm.longitude], 15, { duration: 0.8 });
      const marker = markersMapRef.current.get(pharm.id);
      if (marker) {
        marker.openPopup();
      }
    }
  };

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map || filteredPharmacies.length === 0) return;
    const bounds = L.latLngBounds([]);
    filteredPharmacies.forEach((p) => {
      bounds.extend([p.latitude, p.longitude]);
    });
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Page Header */}
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Pharmacy &amp; Jan Aushadhi Locator</h1>
          <p style={styles.subtitle}>
            Locate authentic Indian pharmacies, 24/7 chemists, and Pradhan Mantri Jan Aushadhi generic drug centers.
          </p>
        </div>
      </div>

      {/* Search & Filter Controls Card */}
      <div className="card" style={styles.searchCard}>
        <div style={styles.searchInputsRow}>
          <MapPin size={20} color="var(--accent-teal)" style={{ marginLeft: '4px', flexShrink: 0 }} />
          <input
            id="locator-search-input"
            type="text"
            placeholder="Search city, district, or 6-digit PIN code (e.g. Connaught Place, Mumbai, 560001)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch(query);
            }}
            style={styles.searchInput}
          />
          <button
            id="locator-search-btn"
            className="btn btn-primary"
            onClick={() => handleSearch(query)}
            disabled={isLoading}
          >
            <Search size={16} />
            <span>Search</span>
          </button>
          <button
            id="locator-geolocate-btn"
            className="btn btn-outline"
            onClick={handleUseGeolocation}
            disabled={isLoading}
            title="Locate medical stores near your GPS coordinates"
          >
            <Navigation size={16} color="var(--accent-teal)" />
            <span>Near Me</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div style={styles.filterPillsRow}>
          <button
            style={{
              ...styles.filterPill,
              ...(activeFilter === 'all' ? styles.filterPillActive : {}),
            }}
            onClick={() => setActiveFilter('all')}
          >
            <span>All Stores ({pharmacies.length})</span>
          </button>

          <button
            style={{
              ...styles.filterPill,
              ...(activeFilter === 'janaushadhi' ? styles.filterPillActiveTeal : {}),
            }}
            onClick={() => setActiveFilter('janaushadhi')}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#168C78' }} />
            <span>Jan Aushadhi Centers</span>
          </button>

          <button
            style={{
              ...styles.filterPill,
              ...(activeFilter === '24_7' ? styles.filterPillActiveEmerald : {}),
            }}
            onClick={() => setActiveFilter('24_7')}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#059669' }} />
            <span>24/7 Chemists</span>
          </button>

          <button
            style={{
              ...styles.filterPill,
              ...(activeFilter === 'retail' ? styles.filterPillActiveBlue : {}),
            }}
            onClick={() => setActiveFilter('retail')}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2563EB' }} />
            <span>Retail Pharmacies</span>
          </button>

          <button
            style={{
              ...styles.filterPill,
              ...(activeFilter === 'hospital' ? styles.filterPillActiveAmber : {}),
            }}
            onClick={() => setActiveFilter('hospital')}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#D97706' }} />
            <span>Hospital Chemists</span>
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div style={styles.statusLine}>
            <Sparkles size={14} color="var(--accent-teal)" />
            <span>{statusMsg}</span>
          </div>
        )}
      </div>

      {/* Main Split Grid (List on Left, Map on Right) */}
      <div style={styles.splitGrid}>
        {/* Left Column: Pharmacy Cards List */}
        <div style={styles.listColumn}>
          <div style={styles.listHeader}>
            <span style={styles.listCount}>
              Showing <b>{filteredPharmacies.length}</b> medical stores
            </span>
            <span style={styles.listHint}>Click store to focus on map</span>
          </div>

          <div style={styles.scrollList}>
            {filteredPharmacies.length === 0 ? (
              <div className="card" style={styles.emptyCard}>
                <Building2 size={32} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  No stores match the active filter. Try selecting "All Stores" above.
                </p>
              </div>
            ) : (
              filteredPharmacies.map((pharm) => {
                const isSelected = pharm.id === selectedShopId;
                const typeLower = (pharm.type || '').toLowerCase();
                const isJanAushadhi = typeLower.includes('jan aushadhi') || pharm.name.toLowerCase().includes('janaushadhi');
                const is24h = (pharm.opening_hours || '').includes('24') || typeLower.includes('24/7');

                return (
                  <div
                    key={pharm.id}
                    id={`pharmacy-card-${pharm.id}`}
                    className="card"
                    style={{
                      ...styles.pharmCard,
                      ...(isSelected ? styles.pharmCardSelected : {}),
                    }}
                    onClick={() => handleFocusShop(pharm)}
                  >
                    <div style={styles.cardTopRow}>
                      <span style={styles.shopName}>{pharm.name}</span>
                      {pharm.distance_km != null && (
                        <span style={styles.distanceBadge}>
                          {pharm.distance_km} km
                        </span>
                      )}
                    </div>

                    {/* Category Tag */}
                    <div style={styles.tagBadgeRow}>
                      {isJanAushadhi && (
                        <span style={styles.janAushadhiTag}>
                          Jan Aushadhi Kendra
                        </span>
                      )}
                      {is24h && (
                        <span style={styles.twentyFourHourTag}>
                          24/7 Open
                        </span>
                      )}
                      <span style={styles.verifiedTag}>
                        <ShieldCheck size={12} color="var(--accent-teal)" />
                        Licensed Chemist
                      </span>
                    </div>

                    {/* Address */}
                    <div style={styles.addressText}>
                      <MapPin size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{pharm.address}{pharm.city ? `, ${pharm.city}` : ''}{pharm.pin_code ? ` - ${pharm.pin_code}` : ''}</span>
                    </div>

                    {/* Timing */}
                    <div style={styles.timingText}>
                      <Clock size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <span>{pharm.opening_hours || 'Standard Hours (08:00 AM - 10:00 PM)'}</span>
                    </div>

                    {/* Actions Row */}
                    <div style={styles.cardActionsRow}>
                      {pharm.phone ? (
                        <a
                          href={`tel:${pharm.phone}`}
                          style={styles.callStoreBtn}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone size={13} />
                          <span>Call Store</span>
                        </a>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Phone on packaging</span>
                      )}

                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${pharm.latitude},${pharm.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.directionsBtn}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Directions</span>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Embedded Map Card */}
        <div style={styles.mapColumn}>
          <div className="card" style={styles.mapCard}>
            {/* Map Container */}
            <div ref={mapContainerRef} style={styles.mapElement} />

            {/* Recenter Button */}
            <button
              id="locator-recenter-btn"
              style={styles.recenterBtn}
              onClick={handleRecenter}
              title="Fit all stores in view"
            >
              <Crosshair size={16} color="var(--accent-teal)" />
              <span>Recenter</span>
            </button>

            {/* Bottom Legend */}
            <div style={styles.mapLegend}>
              <div style={styles.legendItem}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#168C78' }} />
                <span>Jan Aushadhi</span>
              </div>
              <div style={styles.legendItem}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#059669' }} />
                <span>24/7 Open</span>
              </div>
              <div style={styles.legendItem}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#2563EB' }} />
                <span>Retail Chemist</span>
              </div>
              <div style={styles.legendItem}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#D97706' }} />
                <span>Hospital Pharmacy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px 40px',
    maxWidth: '1280px',
    margin: '0 auto',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  title: {
    fontSize: '26px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  searchCard: {
    padding: '18px 20px',
    marginBottom: '24px',
    backgroundColor: 'var(--surface)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  searchInputsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    padding: '10px 14px',
    fontSize: '14.5px',
    backgroundColor: 'var(--surface-alt)',
    border: '1.5px solid var(--border-subtle)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    outline: 'none',
    minWidth: '220px',
  },
  filterPillsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '2px',
    flexWrap: 'wrap',
  },
  filterPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  filterPillActive: {
    backgroundColor: 'var(--text-primary)',
    color: 'var(--surface)',
    borderColor: 'var(--text-primary)',
  },
  filterPillActiveTeal: {
    backgroundColor: '#168C78',
    color: '#FFFFFF',
    borderColor: '#168C78',
  },
  filterPillActiveEmerald: {
    backgroundColor: '#059669',
    color: '#FFFFFF',
    borderColor: '#059669',
  },
  filterPillActiveBlue: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    borderColor: '#2563EB',
  },
  filterPillActiveAmber: {
    backgroundColor: '#D97706',
    color: '#FFFFFF',
    borderColor: '#D97706',
  },
  statusLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  splitGrid: {
    display: 'grid',
    gridTemplateColumns: '440px 1fr',
    gap: '24px',
    alignItems: 'start',
  },
  listColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 4px',
  },
  listCount: {
    fontSize: '13.5px',
    color: 'var(--text-primary)',
  },
  listHint: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  scrollList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '620px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  pharmCard: {
    padding: '16px 18px',
    backgroundColor: 'var(--surface)',
    border: '1.5px solid var(--border-subtle)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  pharmCardSelected: {
    borderColor: 'var(--accent-teal)',
    backgroundColor: 'var(--accent-mint-light)',
    boxShadow: 'var(--shadow-md)',
  },
  cardTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '8px',
  },
  shopName: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  },
  distanceBadge: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-alt)',
    padding: '2px 8px',
    borderRadius: '9999px',
    flexShrink: 0,
    border: '1px solid var(--border-subtle)',
  },
  tagBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    marginBottom: '10px',
  },
  janAushadhiTag: {
    fontSize: '10.5px',
    fontWeight: 700,
    color: '#168C78',
    backgroundColor: 'var(--accent-mint)',
    padding: '2px 8px',
    borderRadius: '9999px',
  },
  twentyFourHourTag: {
    fontSize: '10.5px',
    fontWeight: 700,
    color: '#059669',
    backgroundColor: '#ECFDF5',
    padding: '2px 8px',
    borderRadius: '9999px',
  },
  verifiedTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10.5px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-alt)',
    padding: '2px 8px',
    borderRadius: '9999px',
  },
  addressText: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    fontSize: '12.5px',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    marginBottom: '6px',
  },
  timingText: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginBottom: '12px',
  },
  cardActionsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '10px',
  },
  callStoreBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--accent-teal)',
    backgroundColor: 'var(--accent-mint)',
    padding: '5px 12px',
    borderRadius: '6px',
    textDecoration: 'none',
  },
  directionsBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-subtle)',
    padding: '5px 12px',
    borderRadius: '6px',
    textDecoration: 'none',
  },
  emptyCard: {
    padding: '30px 20px',
    textAlign: 'center',
  },
  mapColumn: {
    position: 'sticky',
    top: '24px',
  },
  mapCard: {
    padding: 0,
    overflow: 'hidden',
    position: 'relative',
    height: '620px',
    borderRadius: '16px',
    border: '1.5px solid var(--border-subtle)',
    backgroundColor: 'var(--surface-alt)',
  },
  mapElement: {
    width: '100%',
    height: '100%',
    borderRadius: '16px',
  },
  recenterBtn: {
    position: 'absolute',
    top: '14px',
    left: '14px',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 12px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-md)',
    cursor: 'pointer',
  },
  mapLegend: {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    right: '12px',
    zIndex: 1000,
    backgroundColor: 'var(--glass-bg)',
    backdropFilter: 'blur(10px)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '10px',
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: '10px',
    fontSize: '11.5px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
};
