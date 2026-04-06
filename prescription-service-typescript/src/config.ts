export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  medicationCatalogUrl:
    process.env.MEDICATION_CATALOG_URL || "http://localhost:3050",
  messageBrokerUrl: process.env.MESSAGE_BROKER_URL || "http://localhost:3060",
};
