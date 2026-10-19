# Project rules
- Keep Wait Approval-only column and editing changes behind its explicit modal flag so other project popups remain unchanged.
- Google Sheet writes use a POST server function forwarding only No, the two allowed feedback fields, and a transient user-entered token to the fixed deployed Apps Script endpoint; Apps Script verifies WRITE_TOKEN, and read-back confirms persistence before reporting success.
- Keep write validation in a shared schema and credential entry in a dedicated dialog; never store, log, or return passcodes, and never retry uncertain writes automatically.