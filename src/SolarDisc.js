// src/SolarDisc.js — add to goharanwar/adhan-js ("namaz")
//
// True half-width of the zawal window: the time from the solar disc's leading
// limb touching the local meridian to the disc centre reaching it.
//
//     sin(H½) = sin(s) / cos(δ)        s = apparent semi-diameter of the Sun
//     t½      = H½ / ω                 ω = dH/dt, the rate the hour angle changes
//
// Latitude does not appear. The angular distance from a point at (δ, H) to the
// meridian great circle is  sin d = cos δ · sin H,  which carries no φ term, so
// the disc takes exactly as long to cross the meridian in Karachi as in Tromsø
// on the same date. What does vary is the Sun's distance (perihelion/aphelion,
// which changes s) and its declination.

import Astronomical from './Astronomical';
import SolarCoordinates from './SolarCoordinates';
import { degreesToRadians, radiansToDegrees } from './MathUtils';

// apparent sidereal time advances 360.98564736629° per day
const SIDEREAL_DEGREES_PER_HOUR = 360.98564736629 / 24;

// Meeus: the Sun's apparent semi-diameter is 959.63 arcseconds at 1 AU
const SOLAR_SEMI_DIAMETER_ARCSEC_AT_1AU = 959.63;

const SolarDisc = {
    /**
     * Earth–Sun distance in astronomical units. Meeus, Astronomical Algorithms
     * eq. 25.5 — the same expression the Khanqah workbook uses in SDSN!N3.
     */
    radiusVector(julianCentury) {
        const T = julianCentury;
        const M = Astronomical.meanSolarAnomaly(T);
        const C = Astronomical.solarEquationOfTheCenter(T, M);
        const trueAnomaly = M + C;
        const eccentricity = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
        return (1.000001018 * (1 - eccentricity * eccentricity)) /
               (1 + eccentricity * Math.cos(degreesToRadians(trueAnomaly)));
    },

    /** Apparent semi-diameter of the Sun, in degrees. */
    semiDiameter(julianCentury) {
        return (SOLAR_SEMI_DIAMETER_ARCSEC_AT_1AU /
                SolarDisc.radiusVector(julianCentury)) / 3600;
    },

    /**
     * dH/dt in degrees per hour. The Sun's own eastward drift in right ascension
     * is subtracted from the sidereal rate; that drift is not constant — it is
     * what produces the equation of time — so it is differentiated numerically
     * rather than assumed, which is why this is not simply 15.
     *
     * Using a flat 15 instead changes the result by at most 0.025 s, so this
     * refinement can be dropped if a caller wants fewer SolarCoordinates builds.
     */
    hourAngleRate(julianDay) {
        const step = 0.5 / 24;   // half an hour, in days
        const before = new SolarCoordinates(julianDay - step).rightAscension;
        const after  = new SolarCoordinates(julianDay + step).rightAscension;
        let delta = after - before;
        if (delta > 180) { delta -= 360; }
        if (delta < -180) { delta += 360; }
        return SIDEREAL_DEGREES_PER_HOUR - delta / (2 * step * 24);
    },

    /**
     * Half the time the solar disc takes to cross the local meridian, in seconds.
     * Ranges from about 63.7 s (mid-September) to 70.9 s (late December).
     */
    zawalHalfWidthSeconds(julianDay) {
        const T = Astronomical.julianCentury(julianDay);
        const semiDiameter = degreesToRadians(SolarDisc.semiDiameter(T));
        const declination = degreesToRadians(new SolarCoordinates(julianDay).declination);
        const halfWidthDegrees = radiansToDegrees(
            Math.asin(Math.sin(semiDiameter) / Math.cos(declination)));
        return (halfWidthDegrees / SolarDisc.hourAngleRate(julianDay)) * 3600;
    }
};

export default SolarDisc;
