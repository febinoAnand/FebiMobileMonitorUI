// Sample data for the UI only.
// When the backend is ready, replace this with API calls that return the same shapes.
//
// One login (account) can link several phones, and each phone can hold two SIMs.
// Every message and call belongs to one of the account's numbers (numberId).
// Linked numbers are created on the "Add a phone" page and get ids n1, n2, n3… in order,
// so the sample messages below show up on the 1st, 2nd and 3rd number you link.
//
// contact:  { id, name, phone, email, address, company, label, notes }
// message:  { id, contactId, numberId, direction: "in" | "out", text, time (ISO string), read }
// call:     { id, contactId, numberId, type: "incoming" | "outgoing" | "missed" | "rejected", time, duration (seconds) }

// user: { id, name, username, email, role: "Admin" | "Editor" | "Viewer", active, lastLogin (ISO string or null),
//         phoneCountry, phoneNumber (digits only, "" if none), phoneVerified }
// The signed-in user's own numbers come from their linked phones (getNumbers() in common.js).
const USERS = [
  { id: "u1", name: "Admin", username: "admin", email: "admin@smsreader.com", role: "Admin", active: true, lastLogin: "2026-10-26T09:30:00", phoneCountry: "+91", phoneNumber: "", phoneVerified: false },
  { id: "u2", name: "Priya Sharma", username: "priya", email: "priya.sharma@example.com", role: "Editor", active: true, lastLogin: "2026-10-25T17:12:00", phoneCountry: "+91", phoneNumber: "9845012345", phoneVerified: true },
  { id: "u3", name: "Rahul Verma", username: "rahul", email: "rahul.v@example.com", role: "Viewer", active: true, lastLogin: "2026-10-22T11:05:00", phoneCountry: "+91", phoneNumber: "9900167890", phoneVerified: true },
  { id: "u4", name: "Anita Desai", username: "anita", email: "anita.d@example.com", role: "Editor", active: false, lastLogin: "2026-09-30T15:40:00", phoneCountry: "+91", phoneNumber: "9123456780", phoneVerified: false },
  { id: "u5", name: "Karthik Rao", username: "karthik", email: "", role: "Viewer", active: true, lastLogin: null, phoneCountry: "+91", phoneNumber: "", phoneVerified: false }
];

const CONTACTS = [
  {
    id: "c1",
    name: "Priya Sharma",
    phone: "+91 98450 12345",
    email: "priya.sharma@example.com",
    address: "12 MG Road, Bengaluru",
    company: "Febino Solutions",
    label: "Work",
    notes: "Project lead for the mobile app."
  },
  {
    id: "c2",
    name: "Rahul Verma",
    phone: "+91 99001 67890",
    email: "rahul.v@example.com",
    address: "45 Anna Salai, Chennai",
    company: "",
    label: "Friend",
    notes: ""
  },
  {
    id: "c3",
    name: "",
    phone: "AX-HDFCBK",
    email: "",
    address: "",
    company: "HDFC Bank",
    label: "Service",
    notes: "Bank alerts"
  },
  {
    id: "c4",
    name: "Mom",
    phone: "+91 94440 11223",
    email: "",
    address: "Home",
    company: "",
    label: "Family",
    notes: ""
  },
  {
    id: "c5",
    name: "",
    phone: "+91 80123 45678",
    email: "",
    address: "",
    company: "",
    label: "Unknown",
    notes: ""
  },
  {
    id: "c6",
    name: "Arjun Mehta",
    phone: "+91 99887 66554",
    email: "arjun@mehtatraders.in",
    address: "8 Commercial Street, Bengaluru",
    company: "Mehta Traders",
    label: "Work",
    notes: "Client — orders every month."
  }
];

const MESSAGES = [
  { id: "m1",  contactId: "c1", numberId: "n2", direction: "in",  text: "Hi Vijay, are we still on for the review meeting tomorrow?", time: "2026-10-24T09:12:00", read: true },
  { id: "m2",  contactId: "c1", numberId: "n2", direction: "out", text: "Yes, 11 AM works for me.", time: "2026-10-24T09:15:00", read: true },
  { id: "m3",  contactId: "c1", numberId: "n2", direction: "in",  text: "Great. Please bring the updated UI mockups for the SMS reader.", time: "2026-10-24T09:16:00", read: true },
  { id: "m4",  contactId: "c1", numberId: "n2", direction: "in",  text: "Also, the client asked if we can show the contact details next to each conversation. Can you check?", time: "2026-10-26T10:41:00", read: false },

  { id: "m5",  contactId: "c2", numberId: "n1", direction: "in",  text: "Bro, cricket this Sunday?", time: "2026-10-25T18:02:00", read: true },
  { id: "m6",  contactId: "c2", numberId: "n1", direction: "out", text: "I'm in! Same ground as last time?", time: "2026-10-25T18:10:00", read: true },
  { id: "m7",  contactId: "c2", numberId: "n1", direction: "in",  text: "Yes, 7 AM sharp. Don't be late this time 😄", time: "2026-10-25T18:11:00", read: true },

  { id: "m8",  contactId: "c3", numberId: "n1", direction: "in",  text: "Rs.2,450.00 debited from A/c XX1234 on 25-10-26 to VPA swiggy@icici. Avl Bal: Rs.18,320.55. Not you? Call 18002586161.", time: "2026-10-25T13:27:00", read: true },
  { id: "m9",  contactId: "c3", numberId: "n1", direction: "in",  text: "Rs.50,000.00 credited to A/c XX1234 on 26-10-26 by NEFT. Avl Bal: Rs.68,320.55.", time: "2026-10-26T08:05:00", read: false },

  { id: "m10", contactId: "c4", numberId: "n1", direction: "in",  text: "Did you eat lunch?", time: "2026-10-23T13:45:00", read: true },
  { id: "m11", contactId: "c4", numberId: "n1", direction: "out", text: "Yes amma, just finished.", time: "2026-10-23T14:02:00", read: true },
  { id: "m12", contactId: "c4", numberId: "n1", direction: "in",  text: "Call me when you are free tonight.", time: "2026-10-23T14:05:00", read: true },

  { id: "m13", contactId: "c5", numberId: "n2", direction: "in",  text: "Your OTP for login is 482913. Do not share it with anyone. Valid for 10 minutes.", time: "2026-10-26T11:58:00", read: false },

  { id: "m14", contactId: "c1", numberId: "n2", direction: "in",  text: "Welcome to the SMS reader project! Kickoff call is on Thursday.", time: "2026-10-20T10:00:00", read: true },
  { id: "m15", contactId: "c1", numberId: "n2", direction: "out", text: "Thanks Priya, looking forward to it.", time: "2026-10-20T10:20:00", read: true },
  { id: "m16", contactId: "c2", numberId: "n1", direction: "in",  text: "Did you watch the match last night?", time: "2026-10-21T21:30:00", read: true },
  { id: "m17", contactId: "c2", numberId: "n1", direction: "out", text: "Yes! What a finish 🔥", time: "2026-10-21T21:34:00", read: true },
  { id: "m18", contactId: "c2", numberId: "n1", direction: "in",  text: "Unbelievable. Let's play this weekend.", time: "2026-10-21T21:36:00", read: true },
  { id: "m19", contactId: "c3", numberId: "n1", direction: "in",  text: "Rs.1,200.00 debited from A/c XX1234 on 22-10-26 for electricity bill. Avl Bal: Rs.20,770.55.", time: "2026-10-22T07:45:00", read: true },
  { id: "m20", contactId: "c4", numberId: "n1", direction: "in",  text: "Coming home this weekend?", time: "2026-10-22T19:10:00", read: true },
  { id: "m21", contactId: "c4", numberId: "n1", direction: "out", text: "Yes, reaching Saturday evening.", time: "2026-10-22T19:25:00", read: true },

  { id: "m22", contactId: "c6", numberId: "n3", direction: "in",  text: "Thanks for the quick delivery last week. The team loved it.", time: "2026-10-24T16:40:00", read: true },
  { id: "m23", contactId: "c6", numberId: "n3", direction: "in",  text: "Good morning! Can you share the quotation for the next order by noon?", time: "2026-10-26T10:05:00", read: false },
  { id: "m24", contactId: "c6", numberId: "n3", direction: "out", text: "Sure Arjun, sending it within the hour.", time: "2026-10-26T10:12:00", read: true }
];

const CALLS = [
  { id: "k1",  contactId: "c4", numberId: "n1", type: "incoming", time: "2026-10-26T08:15:00", duration: 420 },
  { id: "k2",  contactId: "c1", numberId: "n2", type: "outgoing", time: "2026-10-26T09:05:00", duration: 312 },
  { id: "k3",  contactId: "c6", numberId: "n3", type: "incoming", time: "2026-10-26T10:30:00", duration: 905 },
  { id: "k4",  contactId: "c5", numberId: "n2", type: "missed",   time: "2026-10-26T11:50:00", duration: 0 },
  { id: "k5",  contactId: "c4", numberId: "n1", type: "missed",   time: "2026-10-25T13:02:00", duration: 0 },
  { id: "k6",  contactId: "c6", numberId: "n3", type: "outgoing", time: "2026-10-25T15:00:00", duration: 240 },
  { id: "k7",  contactId: "c2", numberId: "n1", type: "incoming", time: "2026-10-25T18:05:00", duration: 95 },
  { id: "k8",  contactId: "c1", numberId: "n2", type: "missed",   time: "2026-10-25T18:40:00", duration: 0 },
  { id: "k9",  contactId: "c1", numberId: "n2", type: "incoming", time: "2026-10-24T09:20:00", duration: 645 },
  { id: "k10", contactId: "c6", numberId: "n3", type: "missed",   time: "2026-10-24T12:00:00", duration: 0 },
  { id: "k11", contactId: "c5", numberId: "n2", type: "rejected", time: "2026-10-24T16:22:00", duration: 0 },
  { id: "k12", contactId: "c4", numberId: "n1", type: "outgoing", time: "2026-10-23T20:30:00", duration: 1260 },
  { id: "k13", contactId: "c2", numberId: "n1", type: "rejected", time: "2026-10-22T10:10:00", duration: 0 },
  { id: "k14", contactId: "c2", numberId: "n1", type: "outgoing", time: "2026-10-21T21:40:00", duration: 180 }
];
