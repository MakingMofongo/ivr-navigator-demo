// Three realistic insurer call scenarios.
//
// Each is a small IVR graph (>= 4 menu hops) ending in a hold queue and a live
// rep. The transcripts are written the way these lines actually sound on
// insurer support lines, so the detector and agent are exercised against
// believable input rather than toy strings.

import { Scenario } from "./types";

export const SCENARIOS: Scenario[] = [
  // ---------------------------------------------------------------------------
  {
    id: "meridian-health",
    insurer: "Meridian Health",
    vertical: "Health — claim status",
    phoneNumber: "+1 (800) 555-0142",
    accent: "#22d3ee",
    goal: "Check the status of claim CLM-44821",
    goalIntents: ["claims", "claim_status", "existing_claim"],
    bridgeTarget: "Dana (client billing team)",
    caseContext: {
      member_id: "MRD-7741-203",
      member_name: "Jordan Avery",
      date_of_birth: "March 4, 1986",
      claim_number: "CLM-44821",
      reason_for_call: "I'm following up on the status of a submitted claim.",
      callback_number: "(415) 555-0199",
      provider_name: "Northside Family Practice",
      date_of_service: "May 12, 2026",
    },
    startNode: "main",
    nodes: {
      main: {
        id: "main",
        type: "menu",
        prompt:
          "Thank you for calling Meridian Health. Please listen carefully as our menu options have recently changed. For claims, press 1. For member services, press 2. For provider services, press 3. For billing and payments, press 4. To repeat this menu, press 9.",
        options: [
          { digit: "1", label: "Claims", intents: ["claims", "claim_status"], next: "claims" },
          { digit: "2", label: "Member services", intents: ["eligibility", "benefits"], next: "main" },
          { digit: "3", label: "Provider services", intents: ["provider"], next: "main" },
          { digit: "4", label: "Billing and payments", intents: ["billing", "payment"], next: "main" },
        ],
      },
      claims: {
        id: "claims",
        type: "menu",
        prompt:
          "Claims department. To check the status of an existing claim, press 1. To submit a new claim, press 2. For claim denials and appeals, press 3. To go back, press 0.",
        options: [
          { digit: "1", label: "Check existing claim status", intents: ["claim_status", "existing_claim"], next: "verify" },
          { digit: "2", label: "Submit a new claim", intents: ["new_claim"], next: "claims" },
          { digit: "3", label: "Denials and appeals", intents: ["appeal", "denial"], next: "claims" },
        ],
      },
      verify: {
        id: "verify",
        type: "menu",
        prompt:
          "To help us locate your claim, please tell us how you'd like to identify the account. To use your member ID, press 1. To use the claim number, press 2.",
        options: [
          { digit: "1", label: "Identify by member ID", intents: ["member_id", "existing_claim"], next: "reach_agent" },
          { digit: "2", label: "Identify by claim number", intents: ["claim_number", "claim_status"], next: "reach_agent" },
        ],
      },
      reach_agent: {
        id: "reach_agent",
        type: "menu",
        prompt:
          "Would you like to continue in our automated system or speak with a representative? To continue automated, press 1. To speak with a claims representative, press 2.",
        options: [
          { digit: "1", label: "Continue automated", intents: ["self_service"], next: "reach_agent" },
          { digit: "2", label: "Speak with a representative", intents: ["agent", "representative", "claim_status"], next: "hold" },
        ],
      },
      hold: {
        id: "hold",
        type: "hold",
        prompt:
          "Thank you for your patience. All of our representatives are currently assisting other members. Your estimated wait time is approximately four minutes. Please stay on the line and your call will be answered in the order it was received.",
        holdSeconds: 42,
        next: "rep",
      },
      rep: {
        id: "rep",
        type: "human",
        repName: "Carla",
        turns: [
          {
            text: "Thanks for calling Meridian Health, this is Carla speaking — who do I have the pleasure of helping today?",
          },
          { text: "No problem, I can pull that up. Can I get your member ID please?", asks: "member_id" },
          { text: "Perfect, and to verify the account, what's the date of birth on file?", asks: "date_of_birth" },
          {
            text: "Great, you're all verified. I've got the claim right here — what did you need on it?",
            expectsBridge: true,
          },
        ],
      },
    },
  },

  // ---------------------------------------------------------------------------
  {
    id: "bluestar-priorauth",
    insurer: "BlueStar Insurance",
    vertical: "Health — prior authorization",
    phoneNumber: "+1 (888) 555-0177",
    accent: "#a78bfa",
    goal: "Confirm prior authorization for an MRI on claim PA-90233",
    goalIntents: ["prior_authorization", "auth_status", "imaging"],
    bridgeTarget: "Marcus (client clinical ops)",
    caseContext: {
      member_id: "BS-5520-918",
      member_name: "Priya Raman",
      date_of_birth: "November 18, 1991",
      claim_number: "PA-90233",
      reason_for_call: "I'm calling to confirm a prior authorization for an MRI.",
      callback_number: "(312) 555-0144",
      provider_name: "Lakeshore Imaging Center",
      date_of_service: "June 2, 2026",
    },
    startNode: "main",
    nodes: {
      main: {
        id: "main",
        type: "menu",
        prompt:
          "Thank you for calling BlueStar Insurance. This call may be recorded for quality and training. For eligibility and benefits, press 1. For authorizations and referrals, press 2. For claims, press 3. For pharmacy, press 4.",
        options: [
          { digit: "1", label: "Eligibility and benefits", intents: ["eligibility", "benefits"], next: "main" },
          { digit: "2", label: "Authorizations and referrals", intents: ["prior_authorization", "auth_status", "referral"], next: "auth" },
          { digit: "3", label: "Claims", intents: ["claims"], next: "main" },
          { digit: "4", label: "Pharmacy", intents: ["pharmacy", "rx"], next: "main" },
        ],
      },
      auth: {
        id: "auth",
        type: "menu",
        prompt:
          "Authorizations. To request a new authorization, press 1. To check the status of an existing authorization, press 2. For imaging and radiology authorizations, press 3.",
        options: [
          { digit: "1", label: "Request new authorization", intents: ["new_auth"], next: "auth" },
          { digit: "2", label: "Check existing authorization status", intents: ["auth_status", "prior_authorization"], next: "imaging" },
          { digit: "3", label: "Imaging and radiology", intents: ["imaging", "mri", "radiology"], next: "imaging" },
        ],
      },
      imaging: {
        id: "imaging",
        type: "menu",
        prompt:
          "Imaging authorizations. For MRI and CT scans, press 1. For X-ray, press 2. To speak with an authorization specialist, press 0.",
        options: [
          { digit: "1", label: "MRI and CT", intents: ["mri", "imaging", "auth_status"], next: "confirm" },
          { digit: "2", label: "X-ray", intents: ["xray"], next: "imaging" },
          { digit: "0", label: "Authorization specialist", intents: ["agent", "specialist"], next: "confirm" },
        ],
      },
      confirm: {
        id: "confirm",
        type: "menu",
        prompt:
          "For the status of a submitted imaging authorization, press 1. For authorization requirements and turnaround times, press 2. To speak with an authorization specialist, press 0.",
        options: [
          { digit: "1", label: "Submitted authorization status", intents: ["auth_status", "prior_authorization"], next: "queue1" },
          { digit: "2", label: "Requirements and turnaround", intents: ["requirements"], next: "confirm" },
          { digit: "0", label: "Authorization specialist", intents: ["agent", "specialist"], next: "queue1" },
        ],
      },
      // A two-stage hold: high volume bounce, then the real queue. Tests that the
      // agent does NOT hang up on the first "we're busy, call back" message.
      queue1: {
        id: "queue1",
        type: "hold",
        prompt:
          "We are currently experiencing higher than normal call volume. Your call is important to us. Please continue to hold and the next available specialist will be with you shortly.",
        holdSeconds: 35,
        next: "queue2",
      },
      queue2: {
        id: "queue2",
        type: "hold",
        prompt:
          "Thank you for continuing to hold. All of our specialists are still assisting other callers. You are caller number two in the queue. Please remain on the line.",
        holdSeconds: 28,
        next: "rep",
      },
      rep: {
        id: "rep",
        type: "human",
        repName: "Andre",
        turns: [
          {
            text: "Hi there, thank you for holding — my name is Andre with BlueStar authorizations, how can I help you today?",
          },
          { text: "Sure thing. Could you provide the claim or authorization number?", asks: "claim_number" },
          { text: "Got it. And which provider is this for?", asks: "provider_name" },
          {
            text: "Okay, I see the MRI authorization on file. Let me get the details pulled together for you.",
            expectsBridge: true,
          },
        ],
      },
    },
  },

  // ---------------------------------------------------------------------------
  {
    id: "allied-auto",
    insurer: "Allied Mutual Auto",
    vertical: "Auto — rental coverage",
    phoneNumber: "+1 (877) 555-0163",
    accent: "#f59e0b",
    goal: "Get rental car coverage details on auto claim AC-3318",
    goalIntents: ["claims", "auto_claim", "rental_coverage"],
    bridgeTarget: "Sam (client claims desk)",
    caseContext: {
      member_id: "AM-3318-77",
      member_name: "Leo Martins",
      date_of_birth: "August 22, 1979",
      claim_number: "AC-3318",
      reason_for_call: "I'm checking the rental car coverage on an open auto claim.",
      callback_number: "(206) 555-0121",
      provider_name: "Allied approved body shop #214",
      date_of_service: "June 9, 2026",
    },
    startNode: "main",
    nodes: {
      main: {
        id: "main",
        type: "menu",
        prompt:
          "Thank you for calling Allied Mutual. For a new quote, press 1. To report or check on a claim, press 2. For policy and billing, press 3. For roadside assistance, press 4.",
        options: [
          { digit: "1", label: "New quote", intents: ["quote", "sales"], next: "main" },
          { digit: "2", label: "Claims", intents: ["claims", "auto_claim"], next: "claims" },
          { digit: "3", label: "Policy and billing", intents: ["billing", "policy"], next: "main" },
          { digit: "4", label: "Roadside assistance", intents: ["roadside"], next: "main" },
        ],
      },
      claims: {
        id: "claims",
        type: "menu",
        prompt:
          "Claims center. To report a new claim, press 1. For an existing claim, press 2. For glass and windshield claims, press 3.",
        options: [
          { digit: "1", label: "Report a new claim", intents: ["new_claim"], next: "claims" },
          { digit: "2", label: "Existing claim", intents: ["auto_claim", "existing_claim", "rental_coverage"], next: "auto" },
          { digit: "3", label: "Glass and windshield", intents: ["glass"], next: "claims" },
        ],
      },
      auto: {
        id: "auto",
        type: "menu",
        prompt:
          "For auto claims, press 1. For home claims, press 2. For all other claim types, press 3.",
        options: [
          { digit: "1", label: "Auto claims", intents: ["auto_claim", "rental_coverage"], next: "topic" },
          { digit: "2", label: "Home claims", intents: ["home_claim"], next: "auto" },
          { digit: "3", label: "Other claims", intents: ["other"], next: "auto" },
        ],
      },
      topic: {
        id: "topic",
        type: "menu",
        prompt:
          "For repair status, press 1. For rental car coverage, press 2. To speak with your claims adjuster, press 3.",
        options: [
          { digit: "1", label: "Repair status", intents: ["repair_status"], next: "topic" },
          { digit: "2", label: "Rental car coverage", intents: ["rental_coverage", "auto_claim"], next: "hold" },
          { digit: "3", label: "Claims adjuster", intents: ["agent", "adjuster"], next: "hold" },
        ],
      },
      hold: {
        id: "hold",
        type: "hold",
        prompt:
          "All of our claims associates are currently helping other customers. Thank you for your patience — please stay on the line and the next available associate will take your call.",
        holdSeconds: 31,
        next: "rep",
      },
      rep: {
        id: "rep",
        type: "human",
        repName: "Renee",
        turns: [
          {
            text: "Thanks for holding, you're speaking with Renee at Allied claims — what can I help you with?",
          },
          { text: "Happy to help with that. First, can I have your full name on the policy?", asks: "member_name" },
          { text: "Thank you. And what's the best callback number in case we get disconnected?", asks: "callback_number" },
          {
            text: "Alright, I've found the open auto claim. Let me walk through the rental coverage with you.",
            expectsBridge: true,
          },
        ],
      },
    },
  },
];

export function getScenario(id: string): Scenario {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown scenario: ${id}`);
  return s;
}
