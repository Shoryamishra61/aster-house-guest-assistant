# Product Decisions & Rationale

This document addresses the core design, engineering, and AI tradeoffs made for the Aster House Guest Assistant.

---

## 1. What Customer Problem Are We Solving?

Prospective hotel guests evaluating a stay encounter two primary friction points:
1. **Scattered Static Information:** Policies (check-in/out, parking fees, pet restrictions, breakfast inclusions) are often fragmented across multiple website subpages.
2. **High Misinformation Risk with Unconstrained AI:** When hotels deploy generic conversational chatbots, models routinely hallucinate non-existent amenities (e.g. airport shuttles, casinos, spas) or promise room rates and availability that do not exist.

The Aster House Guest Assistant provides an intuitive conversational interface that resolves questions quickly, while strictly guaranteeing that every fact and room availability count originates exclusively from verified hotel records.

---

## 2. Why Is the Frontend Designed This Way?

The user interface follows the **Anti-Slop Design Constitution**:
- **Quiet Front-Desk Service:** The interface feels like a calm, composed front desk rather than a generic tech demo.
- **No Generic AI Cliches:** We reject purple/blue glowing gradients, glassmorphism, floating decorative orbs, giant marketing heroes, and fake confidence indicators.
- **Controls Where Structure Matters:** Unstructured prose is great for open-ended questions like *"Can I bring my dog?"* but terrible for date entry. When checking availability, the assistant renders an accessible inline date form rather than forcing the user to type ambiguous date phrases.
- **Flat Scanning Hierarchy:** Room results are presented in clean, flat panels displaying the room title, bed configuration, occupancy, nightly rate, total stay cost, and verified amenities in a consistent visual order.

---

## 3. What Is the AI vs. Deterministic Split?

- **The LLM owns language:**
  - Classifying colloquial user intents into typed categories (`knowledge`, `room_suitability`, `availability`, `ambiguous`, `out_of_scope`).
  - Extracting candidate dates and guest counts from unstructured prose.
  - Phrasing grounded facts with natural hospitality tone.
- **Deterministic software owns truth:**
  - Room inventory and live availability calculations.
  - Calendar chronology and stay night math.
  - Room capacity filtering.
  - Total pricing calculations.
  - Storage and retrieval of hotel policy facts.
  - Routing authority and tool allowlists.

---

## 4. What Can Go Wrong with the AI and How Do We Mitigate It?

| Failure Mode | Consequence | Mitigation Strategy |
|---|---|---|
| **Hallucinated Amenities** | Guest expects services the hotel does not offer. | Deterministic lexical retrieval supplies only relevant facts. Post-generation verifier ensures `sourceIds` match supplied facts; otherwise fallback is triggered. |
| **Invented Room Availability** | Guest arrives believing a sold-out room was reserved. | The model has zero access to inventory. Availability is only returned when the deterministic `checkAvailability` tool executes. |
| **Ambiguous Date Expressions** | Booking made for unintended dates. | Model leaves slots `null` when ambiguous; system renders structured form for explicit user confirmation. |
| **Adversarial Injections** | User attempts to make assistant declare false policies. | Input messages are treated strictly as untrusted data in isolated user prompts. Out-of-scope classifier rejects injection attempts. |
| **Model Provider Outage / Latency** | Broken user experience. | Client enforces timeouts (6s); server automatically falls back to deterministic summary templates from retrieved KB items. |

---

## 5. How Do We Measure Success in Production?

1. **Resolution Rate:** Percentage of guest conversations resolved without requiring human front-desk escalation.
2. **Abstention Accuracy:** Percentage of unsupported queries that correctly trigger honest fallback without hallucination (target: 100% on golden set).
3. **Availability Conversion:** Rate at which guests who check availability proceed to select a room or initiate a reservation call.
4. **Clarification Frequency:** Number of turns required to gather valid availability slots.
5. **P95 Latency:** Latency target < 500ms for deterministic/mock flows, < 3s for live LLM flows.
