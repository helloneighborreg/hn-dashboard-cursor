import { withAuth } from '../../../lib/auth';
import { getProperties, getReservations, platformLabel, buildPropertyMap, withReservationPropertyName } from '../../../lib/hospitable';
import { buildPropertyCodeToNameMap, formatPropertyNameForRow } from '../../../lib/codes';
import { parseHostFinancials } from '../../../lib/hospitableFinancials';
import { getExpenses } from '../../../lib/db';
import { reservationActsAsCancelled } from '../../../lib/reservationDates';
import { aggregateAmountsByReportCategory } from '../../../lib/bookkeepingCategories';

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).end();
    const { property, date_from, date_to } = req.query;

    try {
      const properties = await getProperties();
      const propMap = buildPropertyMap(properties);
      const codeToNameMap = buildPropertyCodeToNameMap(properties);
      const ids = property ? [property] : properties.map((p) => p.id);

      // Fetch reservations with financials + guest embedded
      const { data: reservations } = await getReservations(ids, {
        perPage: 500,
        startDate: date_from,
        endDate: date_to,
        include: 'financials,guest',
      });

      const expFilters = {};
      if (property) expFilters.property_id = property;
      if (date_from) expFilters.date_from = date_from;
      if (date_to) expFilters.date_to = date_to;
      const manualExpenses = (await getExpenses(expFilters)).map((e) =>
        formatPropertyNameForRow(e, codeToNameMap, propMap),
      );
      const totalManualExpenses = manualExpenses.reduce((s, e) => s + e.amount, 0);

      const resvData = reservations
        .filter((r) => !reservationActsAsCancelled(r))
        .map((r) => {
          const row = withReservationPropertyName(r, propMap);
          const fin = parseHostFinancials(r.financials?.host);

          const guestName = r.guest
            ? [r.guest.first_name, r.guest.last_name].filter(Boolean).join(' ')
            : null;

          return {
            id: r.id,
            code: r.code,
            platform: r.platform,
            platform_label: platformLabel(r.platform),
            property_id: row.property_id,
            property_name: row.property_name,
            check_in:  r.check_in  || r.arrival_date,
            check_out: r.check_out || r.departure_date,
            nights: r.nights,
            guests: r.guests?.total || 0,
            guest_name: guestName,
            revenue: fin.revenue,
            fees_by_label: fin.fees_by_label,
            owner_payout: fin.revenue,
            month: (r.check_in || r.arrival_date || '').slice(0, 7),
          };
        });

      const totalRevenue = resvData.reduce((s, r) => s + r.revenue, 0);
      const totalNights  = resvData.reduce((s, r) => s + (r.nights || 0), 0);
      const occupancyRate = totalNights > 0 && ids.length > 0
        ? Math.min(100, Math.round((totalNights / (ids.length * 365)) * 10000) / 100)
        : 0;
      const adr = totalNights > 0 ? totalRevenue / totalNights : 0;

      const byMonth = {};
      resvData.forEach((r) => {
        if (!r.month) return;
        byMonth[r.month] = byMonth[r.month] || {
          month: r.month, revenue: 0, nights: 0, reservations: 0, expenses: 0,
        };
        byMonth[r.month].revenue      += r.revenue;
        byMonth[r.month].nights       += r.nights || 0;
        byMonth[r.month].reservations += 1;
      });
      manualExpenses.forEach((e) => {
        const m = e.date?.slice(0, 7);
        if (!m) return;
        byMonth[m] = byMonth[m] || {
          month: m, revenue: 0, nights: 0, reservations: 0, expenses: 0,
        };
        byMonth[m].expenses += e.amount;
      });
      Object.values(byMonth).forEach((m) => { m.net_income = m.revenue - m.expenses; });
      Object.values(byMonth).forEach((m) => {
        const [yearStr, monthStr] = m.month.split('-');
        const monthDays = new Date(Number(yearStr), Number(monthStr), 0).getDate();
        const availableNights = monthDays * ids.length;
        m.adr = m.nights > 0 ? Math.round((m.revenue / m.nights) * 100) / 100 : 0;
        m.occupancy_rate = availableNights > 0
          ? Math.min(100, Math.round((m.nights / availableNights) * 10000) / 100)
          : 0;
        m.revpar = Math.round(m.adr * (m.occupancy_rate / 100) * 100) / 100;
      });

      const byProperty = {};
      resvData.forEach((r) => {
        byProperty[r.property_id] = byProperty[r.property_id] || {
          property_id: r.property_id, property_name: r.property_name,
          revenue: 0, nights: 0, reservations: 0,
        };
        byProperty[r.property_id].revenue      += r.revenue;
        byProperty[r.property_id].nights       += r.nights || 0;
        byProperty[r.property_id].reservations += 1;
      });
      manualExpenses.forEach((e) => {
        const propertyId = e.property_id || 'unknown';
        const property_name = e.property_name || propertyId;
        byProperty[propertyId] = byProperty[propertyId] || {
          property_id: propertyId,
          property_name,
          revenue: 0,
          nights: 0,
          reservations: 0,
        };
        byProperty[propertyId].expenses = (byProperty[propertyId].expenses || 0) + e.amount;
      });

      const availableNightsPerProperty = (() => {
        if (date_from && date_to) {
          const from = new Date(date_from);
          const to = new Date(date_to);
          const dayMs = 1000 * 60 * 60 * 24;
          return to >= from ? Math.floor((to - from) / dayMs) + 1 : 0;
        }
        return 365;
      })();

      Object.values(byProperty).forEach((p) => {
        p.expenses = p.expenses || 0;
        p.net_income = p.revenue - p.expenses;
        p.margin_pct = p.revenue > 0 ? Math.round((p.net_income / p.revenue) * 10000) / 100 : 0;
        p.adr = p.nights > 0 ? Math.round((p.revenue / p.nights) * 100) / 100 : 0;
        p.occupancy_rate = availableNightsPerProperty > 0
          ? Math.min(100, Math.round((p.nights / availableNightsPerProperty) * 10000) / 100)
          : 0;
        p.revpar = Math.round(p.adr * (p.occupancy_rate / 100) * 100) / 100;
      });

      const byPlatform = {};
      resvData.forEach((r) => {
        byPlatform[r.platform] = byPlatform[r.platform] || {
          platform: r.platform, label: r.platform_label, revenue: 0, reservations: 0,
        };
        byPlatform[r.platform].revenue      += r.revenue;
        byPlatform[r.platform].reservations += 1;
      });

      const expenseByCategory = aggregateAmountsByReportCategory(manualExpenses, {
        categoryKey: 'category',
        amountKey: 'amount',
      });

      res.json({
        data: {
          summary: {
            total_revenue:      totalRevenue,
            total_nights:       totalNights,
            total_reservations: resvData.length,
            total_expenses:     totalManualExpenses,
            net_income:         totalRevenue - totalManualExpenses,
            occupancy_rate:     occupancyRate,
            adr:                Math.round(adr * 100) / 100,
            revpar:             Math.round(adr * (occupancyRate / 100) * 100) / 100,
            properties_count:   ids.length,
          },
          monthly_chart:       Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
          by_property:         Object.values(byProperty),
          property_profitability: Object.values(byProperty)
            .sort((a, b) => b.net_income - a.net_income),
          by_platform:         Object.values(byPlatform),
          expense_by_category: expenseByCategory,
          reservations:        resvData,
          expenses:            manualExpenses,
        },
      });
    } catch (err) {
      console.error('Financials error:', err.message);
      res.status(502).json({ error: err.message });
    }
  }, { adminOnly: true });
}
