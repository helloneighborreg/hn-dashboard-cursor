import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, User, Home, CalendarDays, Clock, Users, Tag, ExternalLink,
} from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { formatDateOrDash } from '../lib/dates';
import { platformStyle } from '../lib/platformStyles';
import { parseReservationCheckin, parseReservationCheckout } from '../lib/taskFromReservation';
import { formatClock } from '../lib/taskDisplay';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useFocusTrap } from '../lib/useFocusTrap';

export function reservationGuestName(resv) {
  if (resv.guest?.first_name || resv.guest?.last_name) {
    return [resv.guest.first_name, resv.guest.last_name].filter(Boolean).join(' ');
  }
  return resv.code || 'Guest';
}

function fmtDate(str) {
  return formatDateOrDash(str);
}

function dateAtTime(dateIso, timeHhMm) {
  const date = fmtDate(dateIso);
  if (date === '—') return '—';
  const time = formatClock(timeHhMm).replace(' ', '');
  return `${date} at ${time}`;
}

function DetailRow({ icon: Icon, label, value, mono, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-muted" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted leading-none mb-0.5">{label}</p>
        {children ? (
          <div>{children}</div>
        ) : (
          <p className={`text-sm text-dark leading-snug break-all ${mono ? 'font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded' : 'font-medium'}`}>
            {value || '—'}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ReservationPanel({ resv, propName, onClose }) {
  const [mounted, setMounted] = useState(false);
  useEscapeKey(onClose);
  const dialogRef = useFocusTrap();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const name = reservationGuestName(resv);
  const ps = platformStyle(resv.platform);
  const propertyLabel = propName || resv.property_name || '—';
  const arrStr = resv.check_in || resv.arrival_date;
  const depStr = resv.check_out || resv.departure_date;
  const { checkinDate, checkinTime } = parseReservationCheckin(resv);
  const { checkoutDate, startTime: checkoutTime } = parseReservationCheckout(resv);
  const reservationsHref = resv.code
    ? `/reservations?code=${encodeURIComponent(resv.code)}`
    : '/reservations';

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Reservation: ${name}`}
        className="fixed right-0 top-0 bottom-0 z-[110] w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-hidden focus:outline-none"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: ps.bg }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-dark text-sm leading-snug truncate">{name}</p>
              <p className="text-xs text-muted truncate">{ps.label}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-dark p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
              style={{ backgroundColor: ps.bg + '20', color: ps.bg }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: ps.bg }}
              />
              {resv.status}
            </span>
          </div>

          <div className="space-y-3">
            <DetailRow icon={Home} label="Property" value={propertyLabel} />
            <DetailRow icon={CalendarDays} label="Check-In" value={dateAtTime(checkinDate, checkinTime)} />
            <DetailRow icon={CalendarDays} label="Check-Out" value={dateAtTime(checkoutDate, checkoutTime)} />
            <DetailRow
              icon={Clock}
              label="Duration"
              value={`${resv.nights || differenceInDays(parseISO(depStr || arrStr), parseISO(arrStr))} nights`}
            />
            <DetailRow
              icon={Users}
              label="Guests"
              value={resv.guests?.total ? `${resv.guests.total} guest${resv.guests.total !== 1 ? 's' : ''}` : '—'}
            />
            <DetailRow icon={Tag} label="Reservation code" value={resv.code} mono />
            {resv.guest?.email && (
              <DetailRow icon={User} label="Guest email" value={resv.guest.email} />
            )}
            {resv.guest?.phone_numbers?.[0] && (
              <DetailRow icon={User} label="Guest phone" value={resv.guest.phone_numbers[0]} />
            )}
            {resv.guest?.location && (
              <DetailRow icon={User} label="Guest location" value={resv.guest.location} />
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border space-y-2">
          <a
            href={reservationsHref}
            className="flex items-center justify-center gap-2 w-full btn-primary text-sm"
          >
            View in Reservations
          </a>
          {resv.conversation_id && (
            <a
              href={`https://app.hospitable.com/conversations/${resv.conversation_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full btn-secondary text-sm"
            >
              <ExternalLink size={14} />
              Open in Hospitable
            </a>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
