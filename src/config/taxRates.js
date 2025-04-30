// Tax rates by country and region (state/province/territory)
// Rates are in percentage (e.g., 10 = 10%)

const taxRates = {
  // United States - by state
  "United States": {
    default: 0, // Default if no state is provided
    Alabama: 4,
    Alaska: 0,
    Arizona: 5.6,
    Arkansas: 6.5,
    California: 7.25,
    Colorado: 2.9,
    Connecticut: 6.35,
    Delaware: 0,
    Florida: 6,
    Georgia: 4,
    Hawaii: 4,
    Idaho: 6,
    Illinois: 6.25,
    Indiana: 7,
    Iowa: 6,
    Kansas: 6.5,
    Kentucky: 6,
    Louisiana: 4.45,
    Maine: 5.5,
    Maryland: 6,
    Massachusetts: 6.25,
    Michigan: 6,
    Minnesota: 6.875,
    Mississippi: 7,
    Missouri: 4.225,
    Montana: 0,
    Nebraska: 5.5,
    Nevada: 6.85,
    "New Hampshire": 0,
    "New Jersey": 6.625,
    "New Mexico": 5.125,
    "New York": 4,
    "North Carolina": 4.75,
    "North Dakota": 5,
    Ohio: 5.75,
    Oklahoma: 4.5,
    Oregon: 0,
    Pennsylvania: 6,
    "Rhode Island": 7,
    "South Carolina": 6,
    "South Dakota": 4.5,
    Tennessee: 7,
    Texas: 6.25,
    Utah: 5.95,
    Vermont: 6,
    Virginia: 5.3,
    Washington: 6.5,
    "West Virginia": 6,
    Wisconsin: 5,
    Wyoming: 4,
    "District of Columbia": 6,
  },

  // Canada - by province
  Canada: {
    default: 5, // GST
    Alberta: 5, // GST only
    "British Columbia": 12, // GST + PST
    Manitoba: 12, // GST + PST
    "New Brunswick": 15, // HST
    "Newfoundland and Labrador": 15, // HST
    "Northwest Territories": 5, // GST only
    "Nova Scotia": 15, // HST
    Nunavut: 5, // GST only
    Ontario: 13, // HST
    "Prince Edward Island": 15, // HST
    Quebec: 14.975, // GST + QST
    Saskatchewan: 11, // GST + PST
    Yukon: 5, // GST only
  },

  // Some examples for other countries
  "United Kingdom": {
    default: 20, // VAT
  },
  Australia: {
    default: 10, // GST
  },
  "New Zealand": {
    default: 15, // GST
  },
  Germany: {
    default: 19, // VAT
  },
  France: {
    default: 20, // VAT
  },
  Japan: {
    default: 10, // Consumption tax
  },
  China: {
    default: 13, // VAT
  },
  India: {
    default: 18, // GST
  },
  Brazil: {
    default: 17, // ICMS (approximation)
  },
  Mexico: {
    default: 16, // IVA
  },
  Spain: {
    default: 21, // IVA
  },
  Italy: {
    default: 22, // IVA
  },
  Netherlands: {
    default: 21, // BTW
  },
  Sweden: {
    default: 25, // MOMS
  },
  Norway: {
    default: 25, // MVA
  },
  Denmark: {
    default: 25, // MOMS
  },
  Finland: {
    default: 24, // ALV
  },
  Singapore: {
    default: 8, // GST
  },
};

export default taxRates;
