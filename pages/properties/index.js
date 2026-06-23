import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Bed, Bath, Users } from 'lucide-react';
import Layout from '../../components/Layout';
import PageActionButtons from '../../components/PageActionButtons';
import PageSearchInput from '../../components/PageSearchInput';
import SegmentedToggle from '../../components/SegmentedToggle';
import { PageLoader, ErrorState, EmptyState } from '../../components/LoadingSpinner';
import Badge from '../../components/Badge';
import { fetchJson } from '../../lib/apiClient';
import { getPropertyDisplayName } from '../../lib/codes';
import { requireAuth } from '../../lib/auth';

function PropertyCard({ property }) {
  const addr = property.address;
  const cityState = addr ? `${addr.city}, ${addr.state}` : '';

  return (
    <Link href={`/properties/${property.id}`} className="card overflow-hidden group hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-150 block">
      {/* Image */}
      <div className="relative h-48 bg-brand-50 overflow-hidden">
        {property.picture ? (
          <Image
            src={property.picture}
            alt={property.public_name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">🏡</span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <Badge label={property.listed ? 'Active' : 'Inactive'} variant={property.listed ? 'accepted' : 'cancelled'} />
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-xs text-brand-500 font-medium mb-1 truncate">{property.name || property.public_name}</p>
        <h3 className="font-semibold text-dark text-sm leading-snug mb-2 line-clamp-2">{property.public_name}</h3>

        {cityState && (
          <p className="flex items-center gap-1.5 text-xs text-muted mb-3">
            <MapPin size={12} />
            {cityState}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1"><Bed size={12} /> {property.capacity?.bedrooms ?? '–'} bed</span>
          <span className="flex items-center gap-1"><Bath size={12} /> {property.capacity?.bathrooms ?? '–'} bathrooms</span>
          <span className="flex items-center gap-1"><Users size={12} /> {property.capacity?.max ?? '–'} guests</span>
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
  const [statusFilter, setStatusFilter] = useState('active');

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

  const { activeCount, inactiveCount } = useMemo(() => ({
    activeCount: properties.filter((p) => p.listed).length,
    inactiveCount: properties.filter((p) => !p.listed).length,
  }), [properties]);

  const statusOptions = useMemo(() => [
    { value: 'active', label: `Active (${activeCount})` },
    { value: 'inactive', label: `Inactive (${inactiveCount})` },
  ], [activeCount, inactiveCount]);

  const filtered = useMemo(() => {
    const byStatus = properties.filter((p) =>
      statusFilter === 'active' ? p.listed : !p.listed
    );
    if (!search.trim()) return byStatus;
    const q = search.toLowerCase();
    return byStatus.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        getPropertyDisplayName(p)?.toLowerCase().includes(q) ||
        p.public_name?.toLowerCase().includes(q) ||
        p.address?.city?.toLowerCase().includes(q) ||
        p.address?.display?.toLowerCase().includes(q)
    );
  }, [properties, search, statusFilter]);

  return (
    <>
      <Head><title>Properties — Hello Neighbor</title></Head>
      <Layout title="">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-dark">Properties</h1>
              <p className="text-muted text-sm mt-0.5">
                {activeCount} active · {inactiveCount} inactive
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end w-full lg:w-auto">
              <PageSearchInput
                placeholder="Search properties…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <PageActionButtons onRefresh={load} refreshing={loading} />
            </div>
          </div>
          <SegmentedToggle
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
          />
        </div>

        {loading && <PageLoader message="Loading properties…" />}
        {error && <ErrorState message={error} retry={load} />}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            title={
              search
                ? 'No properties match your search'
                : statusFilter === 'active'
                  ? 'No active properties'
                  : 'No inactive properties'
            }
            message={
              search
                ? 'Try a different search term'
                : statusFilter === 'active'
                  ? 'Listed properties from Hospitable will appear here'
                  : 'Unlisted properties from Hospitable will appear here'
            }
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
