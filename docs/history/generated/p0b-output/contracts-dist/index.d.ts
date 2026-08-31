/**
 * Public identifiers for the normative P0A contracts.
 *
 * The schema/specification files remain the source of truth. This package
 * intentionally does not duplicate schema meaning or implement validation.
 */
export declare const CONTRACT_PACKAGE_VERSION: "0.1.0";
export declare const CONTRACT_SCHEMA_IDS: {
    readonly calculatorVersion: "urn:niro:schema:calculator-version:v1";
    readonly measurementDefinition: "urn:niro:schema:measurement-definition:v1";
    readonly contentPage: "urn:niro:schema:content-page:v1";
};
export type ContractSchemaId = (typeof CONTRACT_SCHEMA_IDS)[keyof typeof CONTRACT_SCHEMA_IDS];
//# sourceMappingURL=index.d.ts.map