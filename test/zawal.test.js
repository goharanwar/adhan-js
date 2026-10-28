import PrayerTimes from '../src/PrayerTimes';
import SolarTime from '../src/SolarTime';
import SolarDisc from '../src/SolarDisc';
import CalculationMethod from '../src/CalculationMethod';
import TimeComponents from '../src/TimeComponents';
import Astronomical from '../src/Astronomical';
import Prayer from '../src/Prayer';
import {dateByAddingDays, roundedMinute} from '../src/DateUtils';

const coordinates = {latitude: 33 + 43 / 60, longitude: 73 + 5 / 60};
const day = new Date(2026, 8, 12, 12);
const params = ihtiyat => Object.assign(CalculationMethod.Karachi(), {ihtiyat});
const rawTransit = (date, location = coordinates) => new TimeComponents(new SolarTime(date, location).transit)
    .utcDate(date.getFullYear(), date.getMonth(), date.getDate());

 test.each([
    [2027, 1, 1, 70.70], [2027, 3, 15, 64.37], [2027, 6, 15, 68.59],
    [2027, 9, 15, 63.68], [2027, 12, 16, 70.81]
])('solar disc anchor %i-%i-%i', (year, month, date, expected) => {
    expect(SolarDisc.zawalHalfWidthSeconds(Astronomical.julianDay(year, month, date, 12)))
        .toBeCloseTo(expected, 1);
});

test('all 1826 dates in 2026–2030 have finite seasonal half-widths', () => {
    let min = Infinity;
    let max = -Infinity;
    let count = 0;
    for (let date = new Date(2026, 0, 1, 12); date.getFullYear() < 2031; date = dateByAddingDays(date, 1)) {
        const width = SolarDisc.zawalHalfWidthSeconds(Astronomical.julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate(), 12));
        expect(width).toBeGreaterThan(63);
        expect(width).toBeLessThan(71);
        min = Math.min(min, width);
        max = Math.max(max, width);
        count++;
    }
    expect(count).toBe(1826);
    expect(max - min).toBeGreaterThan(7);
});

test.each([true, false])('raw-centered window and unchanged rounding policy precise=%s', precise => {
    const p = new PrayerTimes(coordinates, day, params(1), precise);
    const raw = rawTransit(day);
    const center = precise ? raw : roundedMinute(raw);
    const width = SolarDisc.zawalHalfWidthSeconds(Astronomical.julianDay(2026, 9, 12, 12));
    expect(Math.abs((p.dhuhr - center) - (center - p.zawal))).toBeLessThanOrEqual(1);
    expect(p.dhuhr.getTime()).toBe(Math.trunc(center.getTime() + (width + 60) * 1000));
    expect(p.zawalEnd).toBe(p.dhuhr);
    expect(p.dhuhrAzan - p.dhuhr).toBe(60000);
});

test('explicit zero, fractional and district margins replace rather than double add Dhuhr adjustments', () => {
    const p0 = new PrayerTimes(coordinates, day, params(0), true);
    const p1 = new PrayerTimes(coordinates, day, params(1), true);
    const district = params(2.5);
    district.adjustments.dhuhr = 9;
    district.methodAdjustments.dhuhr = 5;
    const p2 = new PrayerTimes(coordinates, day, district, true);
    expect(p1.dhuhr - p0.dhuhr).toBe(60000);
    expect(p0.zawal - p1.zawal).toBe(60000);
    expect(p2.dhuhr - p0.dhuhr).toBe(150000);
});

test.each([-1, NaN, Infinity, -Infinity, '1', null])('invalid ihtiyat %s is rejected', value => {
    expect(() => new PrayerTimes(coordinates, day, params(value), true)).toThrow(RangeError);
});

test('same date produces same half-width at different latitudes and longitudes', () => {
    const first = new PrayerTimes(coordinates, day, params(1), true);
    const secondLocation = {latitude: -33.9, longitude: 151.2};
    const second = new PrayerTimes(secondLocation, day, params(1), true);
    expect(first.dhuhr - rawTransit(day)).toBe(second.dhuhr - rawTransit(day, secondLocation));
});

test.each([true, false])('undefined preserves legacy adjustments and unrelated outputs precise=%s', precise => {
    const legacyParams = params(undefined);
    legacyParams.adjustments.dhuhr = 2;
    const old = new PrayerTimes(coordinates, day, legacyParams, precise);
    const raw = rawTransit(day);
    const adjusted = new Date(+raw + 180000);
    const center = precise ? adjusted : roundedMinute(adjusted);
    expect(old.zawal.getTime()).toBe(+center - 240000);
    expect(old.dhuhr.getTime()).toBe(+center + 64000);
    const fresh = new PrayerTimes(coordinates, day, params(1), precise);
    for (const field of ['fajr', 'sehriEnd', 'sunrise', 'ishraq', 'asr', 'asrMakruh', 'maghrib', 'isha']) {
        expect(fresh[field]).toEqual(old[field]);
    }
});

test.each([true, false])('ishaEnd is tomorrow Sehri and currentPrayer advances precise=%s', precise => {
    const p = new PrayerTimes(coordinates, day, params(1), precise);
    const tomorrow = new PrayerTimes(coordinates, dateByAddingDays(day, 1), params(1), precise);
    expect(p.ishaEnd).toEqual(tomorrow.sehriEnd);
    expect(p.currentPrayer(new Date(+p.sehriEnd - 1))).toBe(Prayer.None);
    expect(p.currentPrayer(p.sehriEnd)).toBe(Prayer.SehriEnd);
    for (const field of ['fajr', 'fajrAzan', 'sunrise', 'ishraq', 'zawal', 'dhuhr', 'dhuhrAzan', 'asr', 'maghrib', 'isha', 'ishaAzan']) {
        expect(p.currentPrayer(p[field])).toBe(field);
    }
    expect(p.currentPrayer(new Date(Date.UTC(2026, 8, 12, 19)))).toBe(Prayer.IshaAzan); // PKT midnight
    expect(p.currentPrayer(new Date(+p.ishaEnd - 1))).toBe(Prayer.IshaAzan);
    expect(p.currentPrayer(p.ishaEnd)).toBe(Prayer.IshaEnd);
    expect(p.timeForPrayer(Prayer.IshaEnd)).toBe(p.ishaEnd);
    expect(p.nextPrayer(p.dhuhr)).toBe(Prayer.Asr);
    expect(p.nextPrayer(p.isha)).toBe(Prayer.None); // Existing single-day API contract.
});

test('ishaEnd remains enumerable, serializable and assignable without recursion', () => {
    const p = new PrayerTimes(coordinates, day, params(1), true);
    expect(Object.keys(p)).toContain('ishaEnd');
    const serialized = JSON.parse(JSON.stringify(p));
    expect(serialized.ishaEnd).toBe(p.ishaEnd.toISOString());
    const copy = {...new PrayerTimes(coordinates, day, params(1), true)};
    expect(copy.ishaEnd).toEqual(p.ishaEnd);
    const fresh = new PrayerTimes(coordinates, day, params(1), true);
    fresh.ishaEnd = day;
    expect(fresh.ishaEnd).toBe(day);
});

test.each([[2026, 11, 31], [2028, 1, 28], [2028, 1, 29], [2026, 2, 29]])('night rollover %i-%i-%i', (year, month, date) => {
    const d = new Date(year, month, date, 12);
    const p = new PrayerTimes(coordinates, d, params(1), true);
    expect(p.ishaEnd).toEqual(new PrayerTimes(coordinates, dateByAddingDays(d, 1), params(1), true).sehriEnd);
    expect(p.ishaEnd.getTime()).toBeGreaterThan(p.isha.getTime());
});

test('lazy night end uses construction-time inputs even when caller later mutates them', () => {
    const mutableDay = new Date(+day);
    const mutableCoordinates = {...coordinates};
    const mutableParams = params(1);
    const expected = new PrayerTimes(coordinates, dateByAddingDays(day, 1), params(1), true).sehriEnd;
    const p = new PrayerTimes(mutableCoordinates, mutableDay, mutableParams, true);
    mutableDay.setDate(1);
    mutableCoordinates.latitude = 0;
    mutableParams.adjustments.fajr = 120;
    expect(p.ishaEnd).toEqual(expected);
});

test('high-latitude fallback retains next Sehri even when existing twilight rules leave no Isha window', () => {
    const location = {latitude: 51.5, longitude: -0.12};
    const date = new Date(2027, 5, 15, 12);
    const p = new PrayerTimes(location, date, params(1), true);
    const next = new PrayerTimes(location, dateByAddingDays(date, 1), params(1), true);
    expect(p.ishaEnd).toEqual(next.sehriEnd);
    expect(p.ishaEnd.getTime()).toBeLessThan(p.isha.getTime());
    expect(p.currentPrayer(p.dhuhr)).toBe(Prayer.Dhuhr);
    // Do not invent extra prayer time beyond the next day's actual Sehri.
    expect(p.currentPrayer(p.ishaEnd)).toBe(Prayer.IshaEnd);
});
