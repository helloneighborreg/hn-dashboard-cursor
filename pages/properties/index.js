import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Bed, Bath, Users, Wifi } from 'lucide-react';
import Layout from '../../components/Layout';
import { PageLoader, ErrorState, EmptyState } from '../../components/LoadingSpinner';
import Badge from '../../components/Badge';
import { fetchJson } from '../../lib/apiClient';
import { requireAuth } from '../../lib/auth';

function AmenityChip({ label }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-brand-50 text-brand-700 font-medium">
      {label}
    </span>
  );
}

function PropertyCard({ property }) {
  const addr = property.address;
  const cityState = addr ? `${addr.city}, ${addr.state}` : '';
  const wifi = property.amenities?.includes('wifi');
  const pool = property.amenities?.includes('pool');
  const pet  = property.house_rules?.pets_allowed;

  return (
    <Link href={`/properties/${property.id}`} className="card overflow-hidden group hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-150 block">
      {/* Image */}
      <div className="relative h-48 bg-brand-50 overflow-hidden">
        {property.picture ? (
          <img
            src={property.picture}
            alt={property.public_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">🏡</span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <Badge label={property.listed ? 'Active' : 'Unlisted'} variant={property.listed ? 'accepted' : 'cancelled'} />
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-xs text-brand-500 font-medium uppercase tracking-wide mb-1 truncate">{property.name}</p>
        <h3 className="font-semibold text-dark text-sm leading-snug mb-2 line-clamp-2">{property.public_name}</h3>

        {cityState && (
          <p className="flex items-center gap-1.5 text-xs text-muted mb-3">
            <MapPin size={12} />
            {cityState}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted mb-3">
          <span className="flex items-center gap-1"><Bed size={12} /> {property.capacity?.bedrooms ?? '–'} bed</span>
          <span className="flex items-center gap-1"><Bath size={12} /> {property.capacity?.bathrooms ?? '–'} bath</span>
          <span className="flex items-center gap-1"><Users size={12} /> {property.capacity?.max ?? '–'} guests</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {wifi && <AmenityChip label="Wi-Fi" />}
          {pool && <AmenityChip label="Pool" />}
          {pet  && <AmenityChip label="Pet-friendly" />}
          {property.amenities?.includes('gym') && <AmenityChip label="Gym" />}
          {property.amenities?.includes('washer') && <AmenityChip label="Laundry" />}
        </div>
      </div>
    </Link>
  );
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const json = await fetchJson('/api/properties');
      if (json) setProperties(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return properties;
    const q = search.toLowerCase();
    return properties.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.public_name?.toLowerCase().includes(q) ||
        p.address?.city?.toLowerCase().includes(q) ||
        p.address?.display?.toLowerCase().includes(q)
    );
  }, [properties, search]);

  return (
    <>
      <Head><title>Properties — Hello Neighbor</title></Head>
      <Layout title="Properties">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-dark">Properties</h1>
            <p className="text-muted text-sm mt-0.5">{properties.length} total properties</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input pl-9"
              placeholder="Search properties…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading && <PageLoader message="Loading properties…" />}
        {error && <ErrorState message={error} retry={load} />}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            title={search ? 'No properties match your search' : 'No properties found'}
            message={search ? 'Try a different search term' : 'Properties from Hospitable will appear here'}
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((p) => <PropertyCard key={p.id} property={p} />)}
          </div>
        )}
      </Layout>
    </>
  );
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
