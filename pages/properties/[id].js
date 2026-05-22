import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowLeft, MapPin, Bed, Bath, Users, Clock, Wifi,
  PawPrint, Cigarette, PartyPopper, ChevronRight
} from 'lucide-react';
import Layout from '../../components/Layout';
import Badge from '../../components/Badge';
import { PageLoader, ErrorState } from '../../components/LoadingSpinner';
import { fetchJson } from '../../lib/apiClient';
import { requireAuth } from '../../lib/auth';

function AmenityTag({ label }) {
  return (
    <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs rounded-full font-medium capitalize">
      {label.replace(/_/g, ' ')}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div className="card p-6 mb-4">
      <h2 className="font-semibold text-dark mb-4 text-sm uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </div>
  );
}

const AMENITY_DISPLAY = {
  wifi: 'Wi-Fi', pool: 'Pool', gym: 'Gym', washer: 'Washer', dryer: 'Dryer',
  dishwasher: 'Dishwasher', ac: 'Air Conditioning', heating: 'Heating',
  bbq: 'BBQ', patio: 'Patio / Balcony', coffee_maker: 'Coffee Maker',
  kitchen: 'Full Kitchen', tv: 'Smart TV', parking: 'Parking',
  free_on_premise_parking: 'Free Parking', hair_dryer: 'Hair Dryer',
  iron: 'Iron', laptop_friendly_workspace: 'Workspace', elevator: 'Elevator',
  travel_crib: 'Pack \'n Play', high_chair: 'High Chair', sauna: 'Sauna',
};

export default function PropertyDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true); setError('');
    fetchJson(`/api/properties/${id}`)
      .then((json) => { if (json) setProperty(json.data); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id || loading) return <Layout><PageLoader message="Loading property…" /></Layout>;
  if (error) return <Layout><ErrorState message={error} /></Layout>;
  if (!property) return null;

  const addr = property.address;
  const images = property.images || [];
  const allImages = [property.picture, ...images.map((i) => i.url || i.original)].filter(Boolean);
  const rules = property.house_rules || {};

  // Amenities: show known ones first, rest as tags
  const amenities = property.amenities || [];
  const featured = amenities.filter((a) => AMENITY_DISPLAY[a]);
  const other = amenities.filter((a) => !AMENITY_DISPLAY[a]);

  return (
    <>
      <Head><title>{`${property.public_name} — Hello Neighbor`}</title></Head>
      <Layout title="">
        {/* Back */}
        <Link href="/properties" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand-500 mb-5 transition-colors">
          <ArrowLeft size={16} /> All Properties
        </Link>

        {/* Hero image */}
        {allImages.length > 0 && (
          <div className="relative h-64 lg:h-96 rounded-2xl overflow-hidden mb-6 bg-brand-50">
            <img
              src={allImages[imgIndex]}
              alt={property.public_name}
              className="w-full h-full object-cover"
            />
            {allImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {allImages.slice(0, 8).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === imgIndex ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            )}
            {allImages.length > 1 && imgIndex < allImages.length - 1 && (
              <button
                onClick={() => setImgIndex(i => Math.min(i + 1, allImages.length - 1))}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Title & address */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-xs text-brand-500 font-medium uppercase tracking-wide mb-1">{property.name}</p>
                  <h1 className="text-xl font-bold text-dark leading-tight">{property.public_name}</h1>
                </div>
                <Badge label={property.listed ? 'Active' : 'Unlisted'} variant={property.listed ? 'accepted' : 'cancelled'} />
              </div>
              {addr && (
                <p className="flex items-center gap-2 text-sm text-muted mb-4">
                  <MapPin size={14} /> {addr.display}
                </p>
              )}
              <div className="flex flex-wrap gap-5 text-sm text-dark">
                <span className="flex items-center gap-1.5"><Bed size={16} className="text-brand-500" /> {property.capacity?.bedrooms ?? '–'} bedroom{property.capacity?.bedrooms !== 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1.5"><Bath size={16} className="text-brand-500" /> {property.capacity?.bathrooms ?? '–'} bath</span>
                <span className="flex items-center gap-1.5"><Users size={16} className="text-brand-500" /> Up to {property.capacity?.max ?? '–'} guests</span>
              </div>
            </div>

            {/* Description */}
            {property.summary && (
              <Section title="About">
                <p className="text-sm text-dark leading-relaxed">{property.summary}</p>
              </Section>
            )}

            {/* Amenities */}
            {amenities.length > 0 && (
              <Section title="Amenities">
                <div className="flex flex-wrap gap-2">
                  {featured.map((a) => <AmenityTag key={a} label={AMENITY_DISPLAY[a]} />)}
                  {other.slice(0, 20).map((a) => <AmenityTag key={a} label={a} />)}
                  {other.length > 20 && (
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                      +{other.length - 20} more
                    </span>
                  )}
                </div>
              </Section>
            )}
          </div>

          {/* Side column */}
          <div className="space-y-4">
            {/* Check-in/out */}
            <Section title="Check-in / Check-out">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted flex items-center gap-2"><Clock size={14} /> Check-in</span>
                  <span className="text-sm font-semibold text-dark">{property.checkin || '4:00 PM'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted flex items-center gap-2"><Clock size={14} /> Check-out</span>
                  <span className="text-sm font-semibold text-dark">{property.checkout || '10:00 AM'}</span>
                </div>
              </div>
            </Section>

            {/* House rules */}
            <Section title="House Rules">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted flex items-center gap-2"><PawPrint size={14} /> Pets</span>
                  <Badge label={rules.pets_allowed ? 'Allowed' : 'Not allowed'} variant={rules.pets_allowed ? 'accepted' : 'cancelled'} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted flex items-center gap-2"><Cigarette size={14} /> Smoking</span>
                  <Badge label={rules.smoking_allowed ? 'Allowed' : 'Not allowed'} variant={rules.smoking_allowed ? 'accepted' : 'cancelled'} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted flex items-center gap-2"><PartyPopper size={14} /> Events</span>
                  <Badge label={rules.events_allowed ? 'Allowed' : 'Not allowed'} variant={rules.events_allowed ? 'accepted' : 'cancelled'} />
                </div>
              </div>
            </Section>

            {/* Property type */}
            <Section title="Property Details">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Type</span>
                  <span className="capitalize font-medium">{property.property_type?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Room type</span>
                  <span className="font-medium">{property.room_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Currency</span>
                  <span className="font-medium">{property.currency}</span>
                </div>
                {property.timezone && (
                  <div className="flex justify-between">
                    <span className="text-muted">Timezone</span>
                    <span className="font-medium">UTC{property.timezone}</span>
                  </div>
                )}
              </div>
            </Section>

            {/* Quick links */}
            <div className="card p-5">
              <h2 className="font-semibold text-dark text-sm uppercase tracking-wide text-muted mb-3">Quick Links</h2>
              <div className="space-y-2">
                <Link
                  href={`/reservations?property=${property.id}`}
                  className="flex items-center justify-between text-sm text-brand-600 hover:text-brand-700 py-1"
                >
                  View reservations <ChevronRight size={14} />
                </Link>
                <Link
                  href={`/tasks?property_id=${property.id}`}
                  className="flex items-center justify-between text-sm text-brand-600 hover:text-brand-700 py-1"
                >
                  View tasks <ChevronRight size={14} />
                </Link>
                <Link
                  href={`/financials?property=${property.id}`}
                  className="flex items-center justify-between text-sm text-brand-600 hover:text-brand-700 py-1"
                >
                  Financial reports <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
