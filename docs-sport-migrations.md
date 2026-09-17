# Sports and category migrations

Administrators open **Sports & categories** in the staff portal.

- Select a sport to edit its name or add event categories.
- For an old category (including free-form CSV values), choose its old value and enter a replacement. An existing category can be the replacement; registrations containing both are deduplicated.
- Review the old value, new value, and current registration count, then apply the migration.
- Migration history records old/new values, affected registration count, timestamp, and the administrator's ID. The screen shows the latest 50 migrations per sport.

The catalog retains the stable sport code and historical name/category aliases. Participant creation, editing, and CSV imports resolve aliases to the current value. Registration fields are updated in the same Convex transaction as the catalog and history, so reactive views and exports see the new values together. The existing text fields remain compatible with current public intake, search, contact directory, and document exports.

Sport and category migrations preserve existing signatures, signer names, signing dates, verification statuses, and identity documents. Participants do not need to sign again after a migration.

Existing sports are supplied from the original defaults until first edited; no initial data rewrite is required. Existing free-form categories are discovered from the selected sport's registrations. No application data is migrated merely by deploying this feature.

Operations are atomic and limited to 2,000 linked registrations, 200 sports, 200 categories per sport, and 200 aliases per name/category. Larger migrations fail without partial writes and require a separate migration approach. Migrations are blocked while a participant removal job is running or paused. Duplicate student registrations under historical sport names must be resolved before migration. Sport names/codes belonging to another sport cannot be reused; combining two sports is not supported.

Verification: `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
