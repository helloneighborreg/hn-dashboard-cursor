import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import {
  ArrowLeft, MapPin, Bed, Bath, Users, Clock,
  PawPrint, Cigarette, PartyPopper, ChevronRight
} from 'lucide-react';
import Layout from '../../components/Layout';
import Badge from '../../components/Badge';
import { PageLoader, ErrorState } from '../../components/LoadingSpinner';
import { useAuth } from '../../components/AuthContext';
import { fetchJson } from '../../lib/apiClient';
import { requireAuth } from '../../lib/auth';
import { isPropertySectionVisible } from '../../lib/propertySectionPermissions';
import PropertyOwnerSection from '../../components/PropertyOwnerSection';
import PropertyOwnerStatementsSection from '../../components/PropertyOwnerStatementsSection';
import PropertySectionAccordion from '../../components/PropertySectionAccordion';
import PropertyLeaseInformationSection from '../../components/PropertyLeaseInformationSection';
import PropertyDetailsExtrasSection from '../../components/PropertyDetailsExtrasSection';
import PropertyBackupInfoSection from '../../components/PropertyBackupInfoSection';
import PropertyUtilityInfoSection from '../../components/PropertyUtilityInfoSection';

function AmenityTag({ label }) {
  return (
    <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs rounded-full font-medium capitalize">
      {label.replace(/_/g, ' ')}
    </span>
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

function PhotoGallery({ images, alt, imgIndex, setImgIndex }) {
  if (!images.length) return null;

  return (
    <div className="relative h-64 lg:h-80 rounded-xl overflow-hidden bg-brand-50">
      <Image
        src={images[imgIndex]}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 100vw, 66vw"
        priority={imgIndex === 0}
        className="object-cover"
      />
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.slice(0, 8).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setImgIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === imgIndex ? 'bg-white' : 'bg-white/50'}`}
            />
          ))}
        </div>
      )}
      {images.length > 1 && imgIndex < images.length - 1 && (
        <button
          type="button"
          onClick={() => setImgIndex((i) => Math.min(i + 1, images.length - 1))}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

function AmenitiesList({ amenities }) {
  const featured = amenities.filter((a) => AMENITY_DISPLAY[a]);
  const other = amenities.filter((a) => !AMENITY_DISPLAY[a]);

  return (
    <div className="flex flex-wrap gap-2">
      {featured.map((a) => <AmenityTag key={a} label={AMENITY_DISPLAY[a]} />)}
      {other.map((a) => <AmenityTag key={a} label={a} />)}
    </div>
  );
}

export default function PropertyDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, navPermissions } = useAuth();
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

  const addr = property?.address;
  const images = property?.images || [];
  const galleryUrls = images.map((i) => i.url || i.original).filter(Boolean);
  const allImages = galleryUrls.length > 0
    ? galleryUrls
    : [property?.picture].filter(Boolean);
  const rules = property?.house_rules || {};
  const amenities = property?.amenities || [];

  const propertyTitle = property?.name || property?.public_name || '';

  const canSeeSection = (key) => isPropertySectionVisible(key, user?.role, navPermissions);

  const mainSections = useMemo(() => {
    if (!property) return [];
    return [
      {
        key: 'photos',
        label: 'Photos',
        visible: allImages.length > 0 && canSeeSection('photos'),
        badge: allImages.length > 1 ? (
          <span className="text-xs text-muted">{allImages.length}</span>
        ) : null,
        content: (
          <PhotoGallery
            images={allImages}
            alt={propertyTitle}
            imgIndex={imgIndex}
            setImgIndex={setImgIndex}
          />
        ),
      },
      {
        key: 'about',
        label: 'About',
        visible: Boolean(property.summary) && canSeeSection('about'),
        content: (
          <p className="text-sm text-dark leading-relaxed">{property.summary}</p>
        ),
      },
      {
        key: 'amenities',
        label: 'Amenities',
        visible: amenities.length > 0 && canSeeSection('amenities'),
        badge: (
          <span className="text-xs text-muted">{amenities.length}</span>
        ),
        content: <AmenitiesList amenities={amenities} />,
      },
    ];
  }, [property, allImages, imgIndex, amenities, propertyTitle, user?.role, navPermissions]);

  const sidebarSections = useMemo(() => {
    if (!property) return [];
    const sections = [
      {
        key: 'owner-info',
        label: 'Owner Info',
        content: <PropertyOwnerSection propertyId={property.id} embedded />,
      },
      {
        key: 'owner-statements',
        label: 'Owner Statements',
        content: <PropertyOwnerStatementsSection propertyId={property.id} embedded />,
      },
      {
        key: 'property-details',
        label: 'Property Details',
        content: (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-muted flex items-center gap-2"><Clock size={14} /> Check-in</span>
                <span className="text-sm font-semibold text-dark sm:text-right">{property.checkin || '4:00 PM'}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-muted flex items-center gap-2"><Clock size={14} /> Check-out</span>
                <span className="text-sm font-semibold text-dark sm:text-right">{property.checkout || '10:00 AM'}</span>
              </div>
            </div>
            <div className="space-y-2.5 pt-4 border-t border-border/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-muted flex items-center gap-2"><PawPrint size={14} /> Pets</span>
                <Badge label={rules.pets_allowed ? 'Allowed' : 'Not allowed'} variant={rules.pets_allowed ? 'accepted' : 'cancelled'} className="self-start sm:self-auto" />
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-muted flex items-center gap-2"><Cigarette size={14} /> Smoking</span>
                <Badge label={rules.smoking_allowed ? 'Allowed' : 'Not allowed'} variant={rules.smoking_allowed ? 'accepted' : 'cancelled'} className="self-start sm:self-auto" />
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-muted flex items-center gap-2"><PartyPopper size={14} /> Events</span>
                <Badge label={rules.events_allowed ? 'Allowed' : 'Not allowed'} variant={rules.events_allowed ? 'accepted' : 'cancelled'} className="self-start sm:self-auto" />
              </div>
            </div>
            <div className="space-y-2 text-sm pt-4 border-t border-border/60">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                <span className="text-muted">Type</span>
                <span className="capitalize font-medium sm:text-right">{property.property_type?.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                <span className="text-muted">Room type</span>
                <span className="font-medium sm:text-right">{property.room_type}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                <span className="text-muted">Currency</span>
                <span className="font-medium sm:text-right">{property.currency}</span>
              </div>
              {property.timezone && (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <span className="text-muted">Timezone</span>
                  <span className="font-medium sm:text-right">UTC{property.timezone}</span>
                </div>
              )}
            </div>
            <PropertyDetailsExtrasSection propertyId={property.id} />
          </div>
        ),
      },
      {
        key: 'lease-information',
        label: 'Lease Information',
        content: <PropertyLeaseInformationSection propertyId={property.id} embedded />,
      },
      {
        key: 'backup-info',
        label: 'Backup Info',
        content: <PropertyBackupInfoSection propertyId={property.id} embedded />,
      },
      {
        key: 'utility-info',
        label: 'Utility Info',
        content: <PropertyUtilityInfoSection propertyId={property.id} embedded />,
      },
      {
        key: 'links',
        label: 'Quick Links',
        content: (
          <div className="space-y-2">
            <Link
              href={`/reservations?property=${property.id}`}
              className="flex items-center justify-between text-sm text-brand-600 hover:text-brand-700 py-1"
            >
              View reservations <ChevronRight size={14} />
            </Link>
            <Link
              href={`/financials?property=${property.id}`}
              className="flex items-center justify-between text-sm text-brand-600 hover:text-brand-700 py-1"
            >
              Financial reports <ChevronRight size={14} />
            </Link>
          </div>
        ),
      },
    ];
    return sections.filter((section) => canSeeSection(section.key));
  }, [property, rules, user?.role, navPermissions]);

  if (!id || loading) return <Layout><PageLoader message="Loading property…" /></Layout>;
  if (error) return <Layout><ErrorState message={error} /></Layout>;
  if (!property) return null;

  return (
    <>
      <Head><title>{`${propertyTitle} — Hello Neighbor`}</title></Head>
      <Layout title="">
        <Link href="/properties" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand-500 mb-5 transition-colors">
          <ArrowLeft size={16} /> All Properties
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-4 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-3">
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-dark leading-tight break-words">{propertyTitle}</h1>
                  {property.public_name && property.public_name !== propertyTitle && (
                    <p className="text-sm text-muted mt-1">{property.public_name}</p>
                  )}
                </div>
                <Badge
                  label={property.listed ? 'Active' : 'Unlisted'}
                  variant={property.listed ? 'accepted' : 'cancelled'}
                  className="self-start shrink-0"
                />
              </div>
              {addr && (
                <p className="flex items-start gap-2 text-sm text-muted mb-4 min-w-0">
                  <MapPin size={14} className="shrink-0 mt-0.5" />
                  <span className="break-words">{addr.display}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-dark">
                <span className="flex items-center gap-1.5"><Bed size={16} className="text-brand-500" /> {property.capacity?.bedrooms ?? '–'} bedroom{property.capacity?.bedrooms !== 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1.5"><Bath size={16} className="text-brand-500" /> {property.capacity?.bathrooms ?? '–'} bathroom{property.capacity?.bathrooms !== 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1.5"><Users size={16} className="text-brand-500" /> {property.capacity?.max ?? '–'} Guests</span>
              </div>
            </div>

            <PropertySectionAccordion sections={mainSections} defaultKey="photos" />
          </div>

          <div className="lg:sticky lg:self-start lg:top-[calc(env(safe-area-inset-top,0px)+2.75rem)]">
            <PropertySectionAccordion
              sections={sidebarSections}
              defaultKey="owner-info"
              stickyHeaders
              className="lg:max-h-[calc(100dvh-env(safe-area-inset-top,0px)-3.75rem)] lg:overflow-y-auto"
            />
          </div>
        </div>
      </Layout>
    </>
  );
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
