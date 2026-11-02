 # School portal architecture

- Keep staff handbook content and workflow descriptions in a dedicated data module; the guide page handles staff access and school-specific editable notes separately so handbook upgrades do not overwrite school notes.
- Result calculations and rankings must share the grading utilities, with server-side mark validation and role-scoped access protecting persisted records.