// @ts-check
/* Shared record shapes, as JSDoc typedefs. Modules pull them in with
   `import { /** @type {import('./types.js').Attendee} *​/ … }`-style annotations or
   `@param {import('./types.js').Attendee} a` on their functions, so a mistyped field
   name (a.s.suger instead of a.s.sugar) is a build-time error, not a runtime bug. */

/** One visitor's screening record, exactly as it round-trips through the database row. @typedef {{
 *   id: string,                       // badge: EXPO-042 (letters, digits and dashes only)
 *   name: string,
 *   age: number|string|null,          // form input may briefly hold a string; migrate normalises it
 *   sex: string,
 *   phone: string,
 *   email: string,
 *   heightCm: number|string|null,     // form input may briefly hold a string; migrate normalises it
 *   s: Record<string, number|null>,   // readings: sys, dia, sugar, chol, weight, veg, walk, water, sleep (+ paper form)
 *   interests: Record<string, any>,   // consent, followUp, churchPlan, heard* ticks — mixed booleans and short strings
 *   prayer: string,
 *   done: boolean,
 *   created_at?: string, updated_at?: string,
 *   chronicList?: string,             // paper form: chronic illnesses text
 * }} Attendee */

/** One volunteer, from the pledge through the service record. @typedef {{
 *   id: string,                       // VOL-1001
 *   name: string, phone: string, email: string,
 *   status: 'prospect'|'registered'|'checkedin',
 *   pledgeExpos: number, skills: string[], pref: string, pref2: string,
 *   booth: string, availability: string[], shirt: string, emergency: string,
 *   since: string, notes: string,
 *   history: { expo: string, date: string, hours: number, role?: string }[],
 *   pledgedOn?: string, registeredOn?: string, checkedIn?: boolean, role?: string, shift?: string,
 *   lead?: boolean,                   // the station's team leader (VOLUNTEER HUB: TEAM LEADERS)
 * }} Volunteer */

/** One membership row as my_account() returns it. @typedef {{
 *   church_id: string, role: 'member'|'staff'|'admin', status: 'pending'|'approved',
 *   full_name: string, phone: string, area: string, birth_date?: string,
 *   attendee_id?: string, followup: boolean, admin_rank?: number,
 *   volunteer_id?: string,            // the member's own pledge, linked by an admin or self-pledged
 * }} Membership */

/** The church block of my_account(). @typedef {{
 *   id: string, name: string, city: string, phone: string, email: string,
 *   status: 'pending'|'active'|'suspended',
 * }} ChurchInfo */

/** One live-queue row. @typedef {{
 *   id: string, church_id: string, attendee_id: string, station: string,
 *   status: 'waiting'|'serving'|'done', joined_at: string,
 * }} QueueEntry */

export {};
