// Host compatibility and npm package releases are separate: the 3.3.4
// shared-library patch cohort preserves the erxes 3.3.2 host contract.
export const ERXES_RELEASE = "3.3.2";
export const ERXES_PACKAGE_RELEASE = "3.3.4";
/** The erxes shared libraries on npm, installed under the names erxes code imports. */
export const ERXES_PACKAGES = {
  "erxes-ui": `npm:@erxes/ui@${ERXES_PACKAGE_RELEASE}`,
  "ui-modules": `npm:@erxes/ui-modules@${ERXES_PACKAGE_RELEASE}`,
  "erxes-api-shared": `npm:@erxes/api-shared@${ERXES_PACKAGE_RELEASE}`,
} as const;
