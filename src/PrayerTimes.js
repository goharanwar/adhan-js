/* eslint-disable max-lines */
/* eslint-disable complexity */
import SolarTime from './SolarTime';
import TimeComponents from './TimeComponents';
import Prayer from './Prayer';
import Astronomical from './Astronomical';
import {
    dateByAddingDays,
    dateByAddingMinutes,
    dateByAddingSeconds,
    roundedMinute,
    dayOfYear,
    isValidDate
} from './DateUtils';
import { shadowLength } from './Madhab';
import {
    PolarCircleResolution,
    polarCircleResolvedValues
} from './PolarCircleResolution';

export default class PrayerTimes {
    // eslint-disable-next-line complexity
    constructor(coordinates, date, calculationParameters, precise) {
        this.coordinates = coordinates;
        this.date = date;
        this.calculationParameters = calculationParameters;
        this.precise = precise || false;

        let solarTime = new SolarTime(date, coordinates);

        let fajrTime;
        let sunriseTime;
        let ishraqTime = "00:00";
        let dhuhrTime;
        let asrTime;
        let asrMakruhTime = "00:00";
        let maghribTime;
        let ishaTime;

        let nightFraction;

        dhuhrTime = new TimeComponents(solarTime.transit).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
        sunriseTime = new TimeComponents(solarTime.sunrise).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
        let sunsetTime = new TimeComponents(solarTime.sunset).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
        let tomorrow = dateByAddingDays(date, 1);
        let tomorrowSolarTime = new SolarTime(tomorrow, coordinates);

        const polarCircleResolver = calculationParameters.polarCircleResolution;
        if (
            (!isValidDate(sunriseTime) || !isValidDate(sunsetTime) || isNaN(tomorrowSolarTime.sunrise))
            && polarCircleResolver !== PolarCircleResolution.Unresolved
        ) {
            const resolved = polarCircleResolvedValues(polarCircleResolver, date, coordinates);
            this.coordinates = resolved.coordinates;
            this.date.setTime(resolved.date.getTime());
            solarTime = resolved.solarTime;
            tomorrow = resolved.tomorrow;
            tomorrowSolarTime = resolved.tomorrowSolarTime;
            const dateComponents = [date.getFullYear(), date.getMonth(), date.getDate()];

            dhuhrTime = new TimeComponents(solarTime.transit).utcDate(...dateComponents);
            sunriseTime = new TimeComponents(solarTime.sunrise).utcDate(...dateComponents);
            sunsetTime = new TimeComponents(solarTime.sunset).utcDate(...dateComponents);
        }

        // eslint-disable-next-line prefer-const
        asrTime = new TimeComponents(solarTime.afternoon(shadowLength(calculationParameters.madhab))).utcDate(date.getFullYear(), date.getMonth(), date.getDate());

        const tomorrowSunrise = new TimeComponents(tomorrowSolarTime.sunrise).utcDate(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        const night = (tomorrowSunrise - sunsetTime) / 1000;

        fajrTime = new TimeComponents(solarTime.hourAngle(-1 * calculationParameters.fajrAngle, false)).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
        ishraqTime = new TimeComponents(solarTime.hourAngle(-1 * calculationParameters.ishraqAngle, false)).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
        asrMakruhTime = new TimeComponents(solarTime.hourAngle(-1 * calculationParameters.asrMakruhAngle, true)).utcDate(date.getFullYear(), date.getMonth(), date.getDate());

        // special case for moonsighting committee above latitude 55
        if (calculationParameters.method === "MoonsightingCommittee" && coordinates.latitude >= 55) {
            nightFraction = night / 7;
            fajrTime = dateByAddingSeconds(sunriseTime, -nightFraction);
        }

        const safeFajr = (function () {
            if (calculationParameters.method === "MoonsightingCommittee") {
                return Astronomical.seasonAdjustedMorningTwilight(coordinates.latitude, dayOfYear(date), date.getFullYear(), sunriseTime);
            }
            else {
                const portion = calculationParameters.nightPortions().fajr;
                nightFraction = portion * night;
                return dateByAddingSeconds(sunriseTime, -nightFraction);
            }
        })();

        if (fajrTime === null || isNaN(fajrTime.getTime()) || safeFajr > fajrTime) {
            fajrTime = safeFajr;
        }

        if (calculationParameters.ishaInterval > 0) {
            ishaTime = dateByAddingMinutes(sunsetTime, calculationParameters.ishaInterval);
        } else {
            ishaTime = new TimeComponents(solarTime.hourAngle(-1 * calculationParameters.ishaAngle, true)).utcDate(date.getFullYear(), date.getMonth(), date.getDate());

            // special case for moonsighting committee above latitude 55
            if (calculationParameters.method === "MoonsightingCommittee" && coordinates.latitude >= 55) {
                nightFraction = night / 7;
                ishaTime = dateByAddingSeconds(sunsetTime, nightFraction);
            }

            const safeIsha = (function () {
                if (calculationParameters.method === "MoonsightingCommittee") {
                    return Astronomical.seasonAdjustedEveningTwilight(coordinates.latitude, dayOfYear(date), date.getFullYear(), sunsetTime);
                }
                else {
                    const portion = calculationParameters.nightPortions().isha;
                    nightFraction = portion * night;
                    return dateByAddingSeconds(sunsetTime, nightFraction);
                }
            })();

            if (ishaTime == null || isNaN(ishaTime.getTime()) || safeIsha < ishaTime) {
                ishaTime = safeIsha;
            }
        }

        maghribTime = sunsetTime;
        if (calculationParameters.maghribAngle) {
            const angleBasedMaghrib = new TimeComponents(solarTime.hourAngle(-1 * calculationParameters.maghribAngle, true)).utcDate(date.getFullYear(), date.getMonth(), date.getDate());
            if (sunsetTime < angleBasedMaghrib && ishaTime > angleBasedMaghrib) {
                maghribTime = angleBasedMaghrib;
            }
        }

        const fajrAdjustment = (calculationParameters.adjustments.fajr || 0) + (calculationParameters.methodAdjustments.fajr || 0);
        const sunriseAdjustment = (calculationParameters.adjustments.sunrise || 0) + (calculationParameters.methodAdjustments.sunrise || 0);
        const dhuhrAdjustment = (calculationParameters.adjustments.dhuhr || 0) + (calculationParameters.methodAdjustments.dhuhr || 0);
        const asrAdjustment = (calculationParameters.adjustments.asr || 0) + (calculationParameters.methodAdjustments.asr || 0);
        const maghribAdjustment = (calculationParameters.adjustments.maghrib || 0) + (calculationParameters.methodAdjustments.maghrib || 0);
        const ishaAdjustment = (calculationParameters.adjustments.isha || 0) + (calculationParameters.methodAdjustments.isha || 0);
        const ishraqAdjustment = (calculationParameters.adjustments.ishraq || 0) + (calculationParameters.methodAdjustments.ishraq || 0);
        const asrMakruhAdjustment = (calculationParameters.adjustments.asrMakruh || 0) + (calculationParameters.methodAdjustments.asrMakruh || 0);

        const fajrPrecise = dateByAddingMinutes(fajrTime, fajrAdjustment);
        const sunrisePrecise = dateByAddingMinutes(sunriseTime, sunriseAdjustment);
        const dhuhrPrecise = dateByAddingMinutes(dhuhrTime, dhuhrAdjustment);
        const asrPrecise = dateByAddingMinutes(asrTime, asrAdjustment);
        const maghribPrecise = dateByAddingMinutes(maghribTime, maghribAdjustment);
        const ishaPrecise = dateByAddingMinutes(ishaTime, ishaAdjustment);
        const ishraqPrecise = dateByAddingMinutes(ishraqTime, ishraqAdjustment);
        const asrMakruhPrecise = dateByAddingMinutes(asrMakruhTime, asrMakruhAdjustment);

        const fajrRounded = roundedMinute(fajrPrecise);
        const sunriseRounded = roundedMinute(sunrisePrecise);
        const dhuhrRounded = roundedMinute(dhuhrPrecise);
        const asrRounded = roundedMinute(asrPrecise);
        const maghribRounded = roundedMinute(maghribPrecise);
        const ishaRounded = roundedMinute(ishaPrecise);
        const ishraqRounded = roundedMinute(ishraqPrecise);
        const asrMakruhRounded = roundedMinute(asrMakruhPrecise);

        if (precise) {
            this.sehriEnd = dateByAddingMinutes(fajrPrecise, -1);
            this.fajr = fajrPrecise;
            this.fajrAzan = dateByAddingMinutes(fajrPrecise, +1);
            this.fajrEnd = dateByAddingMinutes(sunrisePrecise, -1)
            this.sunrise = sunrisePrecise;
            this.ishraq = ishraqPrecise;
            this.ishraqStart = dateByAddingMinutes(ishraqPrecise, +1);
            this.zawal = dateByAddingMinutes(dhuhrPrecise, -4);
            this.dhuhr = dateByAddingSeconds(dateByAddingMinutes(dhuhrPrecise, +1), 4);
            this.dhuhrAzan = dateByAddingSeconds(dateByAddingMinutes(dhuhrPrecise, +2), 4);
            this.dhuhrEnd = dateByAddingMinutes(asrPrecise, -1);
            this.asr = asrPrecise;
            this.asrMakruh = asrMakruhPrecise
            this.asrAzan = dateByAddingMinutes(asrPrecise, +1);
            this.maghrib = maghribPrecise;
            this.iftar = dateByAddingMinutes(maghribPrecise, +1);
            this.maghribEnd = dateByAddingMinutes(ishaPrecise, -1);
            this.isha = ishaPrecise;
            this.ishaAzan = dateByAddingMinutes(ishaPrecise, +1);
            this.ishaEnd = this.sehriEnd; // TODO: Verify if this shows the time for next day's sehri
        } else {


            this.sehriEnd = dateByAddingMinutes(fajrRounded, -1);
            this.fajr = fajrRounded;
            this.fajrAzan = dateByAddingMinutes(fajrRounded, +1);
            this.fajrEnd = dateByAddingMinutes(sunriseRounded, -1)
            this.sunrise = sunriseRounded;
            this.ishraq = ishraqRounded;
            this.ishraqStart = dateByAddingMinutes(ishraqRounded, +1);
            this.zawal = dateByAddingMinutes(dhuhrRounded, -4);
            this.dhuhr = dateByAddingSeconds(dateByAddingMinutes(dhuhrRounded, +1), 4);
            this.dhuhrAzan = dateByAddingSeconds(dateByAddingMinutes(dhuhrRounded, +2), 4);
            this.dhuhrEnd = dateByAddingMinutes(asrRounded, -1);
            this.asr = asrRounded;
            this.asrMakruh = asrMakruhRounded
            this.asrAzan = dateByAddingMinutes(asrRounded, +1);
            this.maghrib = maghribRounded;
            this.iftar = dateByAddingMinutes(maghribRounded, +1);
            this.maghribEnd = dateByAddingMinutes(ishaRounded, -1);
            this.isha = ishaRounded;
            this.ishaAzan = dateByAddingMinutes(ishaRounded, +1);
            this.ishaEnd = this.sehriEnd; // TODO: Verify if this shows the time for next day's sehri
        }

    }

    timeForPrayer(prayer) {
        if (prayer === Prayer.SehriEnd) {
            return this.sehriEnd;
        }
        else if (prayer === Prayer.Fajr) {
            return this.fajr;
        }
        else if (prayer === Prayer.FajrAzan) {
            return this.fajrAzan;
        }
        else if (prayer === Prayer.FajrEnd) {
            return this.fajrEnd;
        }
        else if (prayer === Prayer.Sunrise) {
            return this.sunrise;
        }
        else if (prayer === Prayer.Ishraq) {
            return this.ishraq;
        }
        else if (prayer === Prayer.IshraqStart) {
            return this.ishraqStart;
        }
        else if (prayer === Prayer.Zawal) {
            return this.zawal;
        }
        else if (prayer === Prayer.Dhuhr) {
            return this.dhuhr;
        }
        else if (prayer === Prayer.DhuhrAzan) {
            return this.dhuhrAzan;
        }
        else if (prayer === Prayer.DhuhrEnd) {
            return this.dhuhrEnd;
        }
        else if (prayer === Prayer.Asr) {
            return this.asr;
        }
        else if (prayer === Prayer.AsrAzan) {
            return this.asrAzan;
        }
        else if (prayer === Prayer.AsrMakruh) {
            return this.asrMakruh;
        }
        else if (prayer === Prayer.Maghrib) {
            return this.maghrib;
        }
        else if (prayer === Prayer.Iftar) {
            return this.iftar;
        }
        else if (prayer === Prayer.MaghribEnd) {
            return this.maghribEnd;
        }
        else if (prayer === Prayer.Isha) {
            return this.isha;
        }
        else if (prayer === Prayer.IshaAzan) {
            return this.ishaAzan;
        }
        else if (prayer === Prayer.IshaEnd) { // TODO: Verify if this shows the time for next day's sehri/isha end or if we want to show next days time
            return this.ishaEnd;
        }
        else {
            return null;
        }
    }

    currentPrayer(date) {
        if (typeof date === 'undefined') {
            date = new Date();
        }
        if (date >= this.ishaEnd) {
            return Prayer.IshaEnd;
        }
        else if (date >= this.ishaAzan) {
            return Prayer.IshaAzan;
        }
        else if (date >= this.isha) {
            return Prayer.Isha;
        }
        else if (date >= this.maghribEnd) {
            return Prayer.MaghribEnd;
        }
        else if (date >= this.iftar) {
            return Prayer.Iftar;
        }
        else if (date >= this.maghrib) {
            return Prayer.Maghrib;
        }
        else if (date >= this.asrMakruh) {
            return Prayer.AsrMakruh;
        }
        else if (date >= this.asrAzan) {
            return Prayer.AsrAzan;
        }
        else if (date >= this.asr) {
            return Prayer.Asr;
        }
        else if (date >= this.dhuhrEnd) {
            return Prayer.DhuhrEnd;
        }
        else if (date >= this.dhuhrAzan) {
            return Prayer.DhuhrAzan;
        }
        else if (date >= this.dhuhr) {
            return Prayer.Dhuhr;
        }
        else if (date >= this.zawal) {
            return Prayer.Zawal;
        }
        else if (date >= this.ishraqStart) {
            return Prayer.IshraqStart;
        }
        else if (date >= this.ishraq) {
            return Prayer.Ishraq;
        }
        else if (date >= this.sunrise) {
            return Prayer.Sunrise;
        }
        else if (date >= this.fajrEnd) {
            return Prayer.FajrEnd;

        }
        else if (date >= this.fajrAzan) {
            return Prayer.FajrAzan;
        }
        else if (date >= this.fajr) {
            return Prayer.Fajr;
        }
        else if (date >= this.sehriEnd) {
            return Prayer.SehriEnd;
        }
        else {
            return Prayer.None;
        }
    }

    nextPrayer(date) {
        if (typeof date === 'undefined') {
            date = new Date();
        }
        if (date >= this.isha) {
            return Prayer.None;
        }
        else if (date >= this.maghrib) {
            return Prayer.Isha;
        }
        else if (date >= this.asr) {
            return Prayer.Maghrib;
        }
        else if (date >= this.dhuhr) {
            return Prayer.Asr;
        }
        else if (date >= this.sunrise) {
            return Prayer.Dhuhr;
        }
        else if (date >= this.fajr) {
            return Prayer.Sunrise;
        }
        else {
            return Prayer.Fajr;
        }
    }
}
