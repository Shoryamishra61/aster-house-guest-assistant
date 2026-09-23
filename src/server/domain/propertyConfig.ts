/**
 * Aster House Guest Assistant - Central Property Configuration
 * Single source of truth for hotel identity, timezone, currency, and verified contact channels.
 * Prevents hardcoding and multi-tenant leakage.
 */

export interface PropertyConfig {
  propertyId: string;
  name: string;
  location: string;
  timeZone: string;
  currency: "USD";
  contact: {
    phone: string;
    email: string;
  };
}

export const REGISTERED_PROPERTIES: Record<string, PropertyConfig> = {
  "aster-house-main": {
    propertyId: "aster-house-main",
    name: "Aster House",
    location: "142 Walnut Street, Downtown Historic District",
    timeZone: "America/New_York",
    currency: "USD",
    contact: {
      phone: "+1 (555) 328-9100",
      email: "frontdesk@asterhousehotel.com",
    },
  },
  "harbor-house-test": {
    propertyId: "harbor-house-test",
    name: "Harbor House Test Property",
    location: "500 Ocean Avenue, Seaside Wharf",
    timeZone: "America/Los_Angeles",
    currency: "USD",
    contact: {
      phone: "+1 (555) 999-8800",
      email: "guest@harborhousetest.com",
    },
  },
};

export const DEFAULT_PROPERTY_ID = "aster-house-main";

export function getPropertyConfig(propertyId: string = DEFAULT_PROPERTY_ID): PropertyConfig {
  const config = REGISTERED_PROPERTIES[propertyId];
  if (!config) {
    throw new Error(`TENANT_ERROR: Unknown propertyId '${propertyId}'`);
  }
  return config;
}
