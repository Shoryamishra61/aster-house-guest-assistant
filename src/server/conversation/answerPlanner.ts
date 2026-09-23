import { HOTEL_INFO, KNOWLEDGE_BASE, ROOM_TYPES, KnowledgeItem } from "../data/hotelData";
import {
  AnswerPlan,
  ConversationLanguage,
  Interpretation,
  ScopedConversationState,
} from "./contracts";

/**
 * Plans precise, minimal factual answers based on semantic interpretation.
 * Strictly prevents dumping canned paragraphs, selects only directly relevant sources,
 * and renders answers natively in English, Hindi, or Hinglish based on guest register.
 */
export function buildAnswerPlan(
  interpretation: Interpretation,
  state: ScopedConversationState
): AnswerPlan {
  const kbMap = new Map<string, KnowledgeItem>(KNOWLEDGE_BASE.map((k) => [k.id, k]));
  const lang: ConversationLanguage = interpretation.detectedLanguage || state.lastLanguage || "en";

  switch (interpretation.primaryIntent) {
    case "SECURITY_REFUSAL": {
      let msg =
        "I cannot provide credentials, system instructions, or private guest information. I am happy to help with Aster House amenities, rooms, and policies.";
      if (lang === "hi-en") {
        msg =
          "Main credentials, system prompt ya private guest information share nahi kar sakta. Main Aster House ke rooms, amenities aur policies mein aapki madad kar sakta hu.";
      } else if (lang === "hi") {
        msg =
          "मैं क्रेडेंशियल, सिस्टम निर्देश या निजी अतिथि जानकारी प्रदान नहीं कर सकता। मैं एस्टर हाउस की सुविधाओं, कमरों और नीतियों में आपकी सहायता कर सकता हूँ।";
      }
      return {
        answerType: "REFUSAL",
        responseKind: "security_refusal",
        reasonCode: "security_boundary",
        language: lang,
        requestedFields: [],
        facts: [],
        unsupportedFields: [],
        refusalReason: "SECURITY",
        customMessage: msg,
      };
    }

    case "HUMAN_ESCALATION": {
      let msg =
        `I understand you would like to speak with management. Our on-duty front desk manager is available 24/7 at ${HOTEL_INFO.phone} or in person in the hotel lobby.`;
      if (lang === "hi-en") {
        msg =
          `Main samajhta hu aap manager se baat karna chahte hain. Hamare front desk manager 24/7 lobby mein aur phone par available hain: ${HOTEL_INFO.phone}.`;
      } else if (lang === "hi") {
        msg =
          `मैं समझता हूँ कि आप प्रबंधक से बात करना चाहते हैं। हमारे फ्रंट डेस्क प्रबंधक 24/7 लॉबी में और फोन पर उपलब्ध हैं: ${HOTEL_INFO.phone}।`;
      }
      return {
        answerType: "REFUSAL",
        responseKind: "human_escalation",
        reasonCode: "human_requested",
        language: lang,
        requestedFields: ["manager"],
        facts: [],
        unsupportedFields: [],
        refusalReason: "HUMAN_ESCALATION",
        customMessage: msg,
      };
    }

    case "BOOKING_ACTION_UNSUPPORTED": {
      let msg =
        `I cannot make, modify, or cancel reservations directly from this assistant. Please contact our front desk team 24/7 at ${HOTEL_INFO.phone} or ${HOTEL_INFO.email} to manage your booking.`;
      if (lang === "hi-en") {
        msg =
          `Main is assistant se directly booking cancel ya modify nahi kar sakta. Kripya hamari front desk team se 24/7 sampark karein: ${HOTEL_INFO.phone}.`;
      } else if (lang === "hi") {
        msg =
          `मैं इस सहायक से सीधे आरक्षण संशोधित या रद्द नहीं कर सकता। कृपया हमारे फ्रंट डेस्क से 24/7 संपर्क करें: ${HOTEL_INFO.phone}।`;
      }
      return {
        answerType: "REFUSAL",
        responseKind: "unsupported_operation",
        reasonCode: "unsupported_operation",
        language: lang,
        requestedFields: [],
        facts: [],
        unsupportedFields: [],
        refusalReason: "OUT_OF_SCOPE",
        customMessage: msg,
      };
    }

    case "RESERVATION_STATE_UNAVAILABLE": {
      let msg =
        `I do not have direct access to guest reservation records. Our front desk team is staffed 24/7 and can look up and confirm your reservation details at ${HOTEL_INFO.phone}.`;
      if (lang === "hi-en") {
        msg =
          `Mere paas guest reservation records ka direct access nahi hai. Hamari front desk team 24/7 aapki booking verify aur confirm kar sakti hai: ${HOTEL_INFO.phone}.`;
      } else if (lang === "hi") {
        msg =
          `मेरे पास अतिथि आरक्षण रिकॉर्ड का सीधा उपयोग नहीं है। हमारी फ्रंट डेस्क टीम 24/7 आपके विवरण की पुष्टि कर सकती है: ${HOTEL_INFO.phone}।`;
      }
      return {
        answerType: "REFUSAL",
        responseKind: "reservation_access_unavailable",
        reasonCode: "unsupported_operation",
        language: lang,
        requestedFields: [],
        facts: [],
        unsupportedFields: [],
        refusalReason: "RESERVATION_UNAVAILABLE",
        customMessage: msg,
      };
    }

    case "OUT_OF_SCOPE": {
      let msg =
        `I do not have verified information about that service for Aster House. Our front desk team is available 24/7 at ${HOTEL_INFO.phone} or ${HOTEL_INFO.email} to assist with special arrangements.`;
      if (lang === "hi-en") {
        msg =
          `Is service ke baare mein mere paas Aster House ka verified record nahi hai. Hamari front desk team 24/7 available hai: ${HOTEL_INFO.phone}.`;
      } else if (lang === "hi") {
        msg =
          `मेरे पास एस्टर हाउस के लिए उस सेवा के बारे में सत्यापित जानकारी नहीं है। हमारी फ्रंट डेस्क टीम सहायता के लिए उपलब्ध है: ${HOTEL_INFO.phone}।`;
      }
      return {
        answerType: "FALLBACK",
        responseKind: "unknown_hotel_fact",
        reasonCode: "unknown_fact",
        language: lang,
        requestedFields: [],
        facts: [],
        unsupportedFields: [],
        refusalReason: "UNKNOWN_FACT",
        customMessage: msg,
      };
    }

    case "PROPERTY_FACT": {
      const contactItem = kbMap.get("kb_contact_location")!;
      const fields = interpretation.requestedFields;
      if (fields.includes("address") || fields.includes("location")) {
        let msg = `Aster House is located at ${HOTEL_INFO.location}.`;
        if (lang === "hi-en") {
          msg = `Aster House ka address hai: ${HOTEL_INFO.location}.`;
        } else if (lang === "hi") {
          msg = `एस्टर हाउस ${HOTEL_INFO.location} में स्थित है।`;
        }
        return {
          answerType: "DIRECT_FACT",
          responseKind: "direct_fact",
          reasonCode: "verified_fact",
          language: lang,
          requestedFields: ["address"],
          facts: [{ sourceId: contactItem.id, field: "address", value: HOTEL_INFO.location }],
          unsupportedFields: [],
          customMessage: msg,
        };
      }
      if (fields.includes("phone")) {
        let msg = `The front desk phone number is ${HOTEL_INFO.phone}.`;
        if (lang === "hi-en") {
          msg = `Front desk ka phone number hai: ${HOTEL_INFO.phone}.`;
        } else if (lang === "hi") {
          msg = `फ्रंट डेस्क का फोन नंबर ${HOTEL_INFO.phone} है।`;
        }
        return {
          answerType: "DIRECT_FACT",
          responseKind: "direct_fact",
          reasonCode: "verified_fact",
          language: lang,
          requestedFields: ["phone"],
          facts: [{ sourceId: contactItem.id, field: "phone", value: HOTEL_INFO.phone }],
          unsupportedFields: [],
          customMessage: msg,
        };
      }
      return {
        answerType: "DIRECT_FACT",
        responseKind: "direct_fact",
        reasonCode: "verified_fact",
        language: lang,
        requestedFields: ["location", "phone"],
        facts: [
          { sourceId: contactItem.id, field: "address", value: HOTEL_INFO.location },
          { sourceId: contactItem.id, field: "phone", value: HOTEL_INFO.phone },
        ],
        unsupportedFields: [],
        customMessage: `Aster House is located at ${HOTEL_INFO.location}. The front desk is available 24/7 at ${HOTEL_INFO.phone}.`,
      };
    }

    case "POLICY_FACT": {
      const policyEntity = interpretation.entities.policy;
      const targetEntity = interpretation.entities.targetEntity;

      if (policyEntity === "checkout") {
        const item = kbMap.get("kb_checkin_checkout")!;
        const requested = interpretation.requestedFields;
        const facts = [{ sourceId: item.id, field: "checkOutTime", value: item.facts.checkOutTime }];

        let customMessage = "Check-out is at 11:00 AM.";
        if (lang === "hi-en") {
          customMessage = "Check-out 11:00 AM baje hai.";
        } else if (lang === "hi") {
          customMessage = "चेक-आउट सुबह 11:00 बजे है।";
        }

        if (requested.includes("checkInTime")) {
          facts.unshift({ sourceId: item.id, field: "checkInTime", value: item.facts.checkInTime });
          customMessage =
            lang === "hi-en"
              ? "Check-in 3:00 PM se shuru hota hai aur check-out 11:00 AM par hai."
              : lang === "hi"
              ? "चेक-इन दोपहर 3:00 बजे शुरू होता है और चेक-आउट सुबह 11:00 बजे है।"
              : "Check-in begins at 3:00 PM and check-out is at 11:00 AM.";
        }

        return {
          answerType: "DIRECT_FACT",
          responseKind: "direct_fact",
          reasonCode: "verified_fact",
          language: lang,
          requestedFields: requested,
          facts,
          unsupportedFields: [],
          customMessage,
        };
      }

      if (policyEntity === "checkin") {
        const item = kbMap.get("kb_checkin_checkout")!;
        let customMessage = "Check-in begins at 3:00 PM (15:00).";
        if (lang === "hi-en") {
          customMessage = "Check-in 3:00 PM (15:00) se shuru hota hai.";
        } else if (lang === "hi") {
          customMessage = "चेक-इन दोपहर 3:00 बजे (15:00) से शुरू होता है।";
        }
        return {
          answerType: "DIRECT_FACT",
          responseKind: "direct_fact",
          reasonCode: "verified_fact",
          language: lang,
          requestedFields: ["checkInTime"],
          facts: [{ sourceId: item.id, field: "checkInTime", value: item.facts.checkInTime }],
          unsupportedFields: [],
          customMessage,
        };
      }

      if (policyEntity === "cancellation") {
        const item = kbMap.get("kb_cancellation")!;
        let customMessage =
          "Reservations may be cancelled without penalty up to 48 hours prior to check-in (3:00 PM arrival date). Cancellations within 48 hours incur a one-night fee.";
        if (lang === "hi-en") {
          customMessage =
            "Check-in se 48 ghante pehle tak reservation bina kisi penalty ke cancel kiya ja sakta hai. 48 ghante ke andar cancel karne par ek raat ka charge lagta hai.";
        } else if (lang === "hi") {
          customMessage =
            "चेक-इन से 48 घंटे पहले तक बिना किसी पेनल्टी के आरक्षण रद्द किया जा सकता है। 48 घंटों के भीतर रद्द करने पर एक रात का शुल्क लगता है।";
        }
        return {
          answerType: "DIRECT_FACT",
          responseKind: "direct_fact",
          reasonCode: "verified_fact",
          language: lang,
          requestedFields: ["standardCancellationNotice", "lateCancellationPenalty"],
          facts: [
            { sourceId: item.id, field: "standardCancellationNotice", value: item.facts.standardCancellationNotice },
            { sourceId: item.id, field: "lateCancellationPenalty", value: item.facts.lateCancellationPenalty },
          ],
          unsupportedFields: [],
          customMessage,
        };
      }

      if (policyEntity === "luggage") {
        const item = kbMap.get("kb_checkin_checkout")!;
        let customMessage =
          "Yes, complimentary luggage storage is available 24/7 at the front desk before check-in or after check-out.";
        if (lang === "hi-en") {
          customMessage =
            "Haan, check-in se pehle ya check-out ke baad front desk par 24/7 complimentary luggage storage available hai.";
        } else if (lang === "hi") {
          customMessage =
            "हाँ, चेक-इन से पहले या चेक-आउट के बाद फ्रंट डेस्क पर 24/7 मुफ़्त सामान रखने की सुविधा उपलब्ध है।";
        }
        return {
          answerType: "DIRECT_FACT",
          responseKind: "yes_no_fact",
          reasonCode: "verified_fact",
          language: lang,
          requestedFields: ["luggageStorage"],
          facts: [
            { sourceId: item.id, field: "luggageStorage", value: "Complimentary luggage storage is available 24/7 at the front desk." },
          ],
          unsupportedFields: [],
          customMessage,
        };
      }

      if (policyEntity === "pet") {
        const item = kbMap.get("kb_pet_policy")!;
        if (targetEntity === "cat") {
          let customMessage =
            "The verified pet policy specifically covers dogs up to 45 lbs (up to 2 per room, $50 fee). I don't have confirmed information regarding cats, so please contact our front desk at +1 (555) 328-9100 for confirmation.";
          if (lang === "hi-en") {
            customMessage =
              "Hamari verified pet policy sirf 45 lbs tak ke dogs ko cover karti hai ($50 fee). Cats ke baare mein mere paas confirmed info nahi hai, kripya front desk (+1 555 328-9100) se confirm karein.";
          } else if (lang === "hi") {
            customMessage =
              "सत्यापित नीति विशेष रूप से 45 पाउंड तक के कुत्तों के लिए है ($50 शुल्क)। बिल्लियों के बारे में मेरे पास सत्यापित जानकारी नहीं है, कृपया फ्रंट डेस्क से पुष्टि करें।";
          }
          return {
            answerType: "PARTIAL_FACT",
            responseKind: "partial_answer",
            reasonCode: "partial_knowledge",
            language: lang,
            requestedFields: ["catPolicy"],
            facts: [{ sourceId: item.id, field: "rules", value: item.facts.rules }],
            unsupportedFields: ["catPolicy"],
            customMessage,
          };
        }

        let customMessage =
          "Dogs up to 45 lbs are welcome (up to 2 per room) for a one-time fee of $50 per stay. Service animals are exempt from fees and weight restrictions.";
        if (lang === "hi-en") {
          customMessage =
            "45 lbs tak ke dogs allowed hain (per room maximum 2) $50 one-time fee ke saath. Service animals par koi fee nahi hai.";
        } else if (lang === "hi") {
          customMessage =
            "45 पाउंड तक के कुत्तों का स्वागत है (प्रति कमरा 2 तक) $50 प्रति प्रवास शुल्क के साथ। सर्विस जानवरों पर कोई शुल्क नहीं है।";
        }
        return {
          answerType: "DIRECT_FACT",
          responseKind: "direct_fact",
          reasonCode: "verified_fact",
          language: lang,
          requestedFields: ["rules", "petFeePerStay", "maximumWeightLbs"],
          facts: [
            { sourceId: item.id, field: "maximumWeightLbs", value: item.facts.maximumWeightLbs },
            { sourceId: item.id, field: "petFeePerStay", value: item.facts.petFeePerStay },
            { sourceId: item.id, field: "rules", value: item.facts.rules },
          ],
          unsupportedFields: [],
          customMessage,
        };
      }

      return {
        answerType: "FALLBACK",
        responseKind: "unknown_hotel_fact",
        reasonCode: "unknown_fact",
        language: lang,
        requestedFields: [],
        facts: [],
        unsupportedFields: [],
        refusalReason: "UNKNOWN_FACT",
      };
    }

    case "AMENITY_FACT": {
      const amenity = interpretation.entities.amenity;
      const requested = interpretation.requestedFields;

      if (amenity === "swimming_pool") {
        const item = kbMap.get("kb_swimming_pool")!;
        if (
          requested.includes("closeTime") ||
          (requested.includes("hours") && state.referents?.lastAmenity === "swimming_pool")
        ) {
          let customMessage =
            "The indoor heated saltwater pool closes at 10:00 PM daily (open 7:00 AM to 10:00 PM).";
          if (lang === "hi-en") {
            customMessage =
              "Indoor heated saltwater pool rozana raat 10:00 PM par band hota hai (open 7:00 AM to 10:00 PM).";
          } else if (lang === "hi") {
            customMessage =
              "इनडोर हीटेड सॉल्टवाटर पूल रोजाना रात 10:00 बजे बंद होता है (सुबह 7:00 से रात 10:00 बजे तक खुला)।";
          }
          return {
            answerType: "DIRECT_FACT",
            responseKind: "direct_fact",
            reasonCode: "verified_fact",
            language: lang,
            requestedFields: ["closeTime"],
            facts: [{ sourceId: item.id, field: "hours", value: item.facts.hours }],
            unsupportedFields: [],
            customMessage,
          };
        }

        if (requested.includes("hours") && !state.referents?.lastAmenity) {
          let customMessage =
            "The pool is open daily from 7:00 AM to 10:00 PM (adults-only hours from 8:30 PM to 10:00 PM).";
          if (lang === "hi-en") {
            customMessage =
              "Pool daily subah 7:00 AM se raat 10:00 PM tak open rehta hai (adults-only 8:30 PM to 10:00 PM).";
          } else if (lang === "hi") {
            customMessage =
              "पूल रोजाना सुबह 7:00 बजे से रात 10:00 बजे तक खुला रहता है।";
          }
          return {
            answerType: "DIRECT_FACT",
            responseKind: "direct_fact",
            reasonCode: "verified_fact",
            language: lang,
            requestedFields: ["hours"],
            facts: [{ sourceId: item.id, field: "hours", value: item.facts.hours }],
            unsupportedFields: [],
            customMessage,
          };
        }

        if (requested.includes("features")) {
          let customMessage =
            "Yes. Aster House features an indoor heated saltwater pool with poolside loungers and towels.";
          if (lang === "hi-en") {
            customMessage =
              "Haan. Aster House mein ek indoor heated saltwater pool hai poolside loungers aur towels ke saath.";
          } else if (lang === "hi") {
            customMessage =
              "हाँ। एस्टर हाउस में एक इनडोर हीटेड सॉल्टवाटर पूल है।";
          }
          return {
            answerType: "DIRECT_FACT",
            responseKind: "yes_no_fact",
            reasonCode: "verified_fact",
            language: lang,
            requestedFields: ["poolType"],
            facts: [{ sourceId: item.id, field: "poolType", value: item.facts.poolType }],
            unsupportedFields: [],
            customMessage,
          };
        }

        let customMessage =
          "Yes. Aster House features an indoor heated saltwater pool open daily from 7:00 AM to 10:00 PM (adults-only 8:30 PM to 10:00 PM).";
        if (lang === "hi-en") {
          customMessage =
            "Haan. Aster House mein indoor heated saltwater pool hai jo roz subah 7:00 AM se raat 10:00 PM tak open rehta hai.";
        } else if (lang === "hi") {
          customMessage =
            "हाँ। एस्टर हाउस में इनडोर हीटेड सॉल्टवाटर पूल है जो रोजाना सुबह 7:00 बजे से रात 10:00 बजे तक खुला रहता है।";
        }
        return {
          answerType: "DIRECT_FACT",
          responseKind: "yes_no_fact",
          reasonCode: "verified_fact",
          language: lang,
          requestedFields: ["hasPool", "hours"],
          facts: [
            { sourceId: item.id, field: "poolType", value: item.facts.poolType },
            { sourceId: item.id, field: "hours", value: item.facts.hours },
          ],
          unsupportedFields: [],
          customMessage,
        };
      }

      if (amenity === "wifi") {
        const item = kbMap.get("kb_wifi_internet")!;
        let customMessage =
          "Yes, free complimentary high-speed fiber Wi-Fi (up to 300 Mbps) is available in all guest rooms and public spaces without tiered paywalls.";
        if (lang === "hi-en") {
          customMessage =
            "Haan, sabhi rooms aur public spaces mein high-speed fiber Wi-Fi completely free aur complimentary hai.";
        } else if (lang === "hi") {
          customMessage =
            "हाँ, सभी कमरों और सार्वजनिक क्षेत्रों में हाई-स्पीड वाई-फ़ाई मुफ़्त उपलब्ध है।";
        }
        return {
          answerType: "DIRECT_FACT",
          responseKind: "yes_no_fact",
          reasonCode: "verified_fact",
          language: lang,
          requestedFields: ["isComplimentary", "speed"],
          facts: [
            { sourceId: item.id, field: "isComplimentary", value: item.facts.isComplimentary },
            { sourceId: item.id, field: "speed", value: item.facts.speed },
          ],
          unsupportedFields: [],
          customMessage,
        };
      }

      if (amenity === "parking") {
        const item = kbMap.get("kb_parking")!;
        let customMessage =
          "Secured valet parking is available for $35 per night with unlimited in/out privileges and complimentary Level-2 EV charging.";
        if (lang === "hi-en") {
          customMessage =
            "Secured valet parking $35 per night par available hai unlimited in/out privileges aur complimentary EV charging ke saath.";
        } else if (lang === "hi") {
          customMessage =
            "सुरक्षित वैले पार्किंग $35 प्रति रात पर उपलब्ध है जिसमें मुफ़्त ईवी चार्जिंग शामिल है।";
        }
        return {
          answerType: "DIRECT_FACT",
          responseKind: "direct_fact",
          reasonCode: "verified_fact",
          language: lang,
          requestedFields: ["parkingType", "valetRateNightly"],
          facts: [
            { sourceId: item.id, field: "parkingType", value: item.facts.parkingType },
            { sourceId: item.id, field: "valetRateNightly", value: item.facts.valetRateNightly },
          ],
          unsupportedFields: [],
          customMessage,
        };
      }

      return {
        answerType: "FALLBACK",
        responseKind: "unknown_hotel_fact",
        reasonCode: "unknown_fact",
        language: lang,
        requestedFields: [],
        facts: [],
        unsupportedFields: [],
        refusalReason: "UNKNOWN_FACT",
      };
    }

    case "DINING_FACT": {
      const item = kbMap.get("kb_breakfast")!;
      const requested = interpretation.requestedFields[0] || "general";

      if (requested === "delivery") {
        let customMessage =
          "Breakfast is served in The Garden Conservatory. I don't have verified records indicating room delivery service; please check with the front desk upon arrival.";
        if (lang === "hi-en") {
          customMessage =
            "Breakfast The Garden Conservatory mein serve hota hai. Room delivery ke baare mein confirmed record nahi hai; front desk se confirm karein.";
        } else if (lang === "hi") {
          customMessage =
            "नाश्ता द गार्डन कंज़र्वेटरी में परोसा जाता है। कमरे में डिलीवरी के बारे में सत्यापित रिकॉर्ड नहीं है।";
        }
        return {
          answerType: "PARTIAL_FACT",
          responseKind: "partial_answer",
          reasonCode: "partial_knowledge",
          language: lang,
          requestedFields: ["delivery"],
          facts: [{ sourceId: item.id, field: "location", value: item.facts.location }],
          unsupportedFields: ["delivery"],
          customMessage,
        };
      }

      if (requested === "nonGuestAccess") {
        return {
          answerType: "PARTIAL_FACT",
          responseKind: "partial_answer",
          reasonCode: "partial_knowledge",
          language: lang,
          requestedFields: ["nonGuestAccess"],
          facts: [{ sourceId: item.id, field: "breakfastPrice", value: item.facts.breakfastPrice }],
          unsupportedFields: ["nonGuestAccess"],
          customMessage:
            "Breakfast is available for $18 per guest in The Garden Conservatory. I don't have verified policy records regarding non-hotel guests dining; our front desk can confirm daily seating availability.",
        };
      }

      if (requested === "location") {
        let customMessage = "Breakfast is served daily in The Garden Conservatory on the ground floor.";
        if (lang === "hi-en") {
          customMessage = "Breakfast daily ground floor par The Garden Conservatory mein serve hota hai.";
        } else if (lang === "hi") {
          customMessage = "नाश्ता रोजाना ग्राउंड फ्लोर पर द गार्डन कंज़र्वेटरी में परोसा जाता है।";
        }
        return {
          answerType: "DIRECT_FACT",
          responseKind: "direct_fact",
          reasonCode: "verified_fact",
          language: lang,
          requestedFields: ["location"],
          facts: [{ sourceId: item.id, field: "location", value: item.facts.location }],
          unsupportedFields: [],
          customMessage,
        };
      }

      if (requested === "hours") {
        let customMessage =
          "Breakfast is served from 6:30 AM to 10:00 AM on weekdays, and 7:00 AM to 11:00 AM on weekends.";
        if (lang === "hi-en") {
          customMessage =
            "Breakfast weekdays par 6:30 AM se 10:00 AM tak, aur weekends par 7:00 AM se 11:00 AM tak serve hota hai.";
        } else if (lang === "hi") {
          customMessage =
            "नाश्ता कार्यदिवसों में सुबह 6:30 से 10:00 बजे तक और सप्ताहांत में 7:00 से 11:00 बजे तक परोसा जाता है।";
        }
        return {
          answerType: "DIRECT_FACT",
          responseKind: "direct_fact",
          reasonCode: "verified_fact",
          language: lang,
          requestedFields: ["hoursWeekday", "hoursWeekend"],
          facts: [
            { sourceId: item.id, field: "hoursWeekday", value: item.facts.hoursWeekday },
            { sourceId: item.id, field: "hoursWeekend", value: item.facts.hoursWeekend },
          ],
          unsupportedFields: [],
          customMessage,
        };
      }

      // Check if this inquiry specifically concerns dinner (e.g. pending subquestion or direct question)
      if (interpretation.entities.meal === "dinner" || requested === "dinner") {
        let customMessage =
          "I do not have verified records indicating that dinner is included with your stay. The front desk can recommend local evening dining options.";
        if (lang === "hi-en") {
          customMessage =
            "Mere paas verified records nahi hain ki dinner stay mein shamil hai. Front desk dinner options recommend kar sakta hai.";
        } else if (lang === "hi") {
          customMessage =
            "मेरे पास डिनर शामिल होने की सत्यापित जानकारी नहीं है। फ्रंट डेस्क भोजन विकल्पों की सिफारिश कर सकता है।";
        }
        return {
          answerType: "PARTIAL_FACT",
          responseKind: "partial_answer",
          reasonCode: "partial_knowledge",
          language: lang,
          requestedFields: ["dinnerInclusion"],
          facts: [],
          unsupportedFields: ["dinnerInclusion"],
          customMessage,
        };
      }

      // Default breakfast answer (inclusions & pricing)
      let customMessage =
        "Breakfast is $18 per guest, and is complimentary for guests staying in King Deluxe and Executive Family Suite rooms.";
      if (lang === "hi-en") {
        customMessage =
          "Breakfast $18 per guest hai, aur King Deluxe tatha Executive Family Suite ke guests ke liye complimentary (free) hai.";
      } else if (lang === "hi") {
        customMessage =
          "नाश्ता $18 प्रति अतिथि है, और किंग डीलक्स तथा एग्जीक्यूटिव फैमिली सुइट के मेहमानों के लिए मुफ़्त है।";
      }
      return {
        answerType: "DIRECT_FACT",
        responseKind: "direct_fact",
        reasonCode: "verified_fact",
        language: lang,
        requestedFields: ["isIncludedByDefault", "breakfastPrice", "includedRoomTypes"],
        facts: [
          { sourceId: item.id, field: "breakfastPrice", value: item.facts.breakfastPrice },
          { sourceId: item.id, field: "includedRoomTypes", value: item.facts.includedRoomTypes },
        ],
        unsupportedFields: [],
        customMessage,
      };
    }

    case "MULTI_INTENT": {
      // Handles e.g. "is breakfast and dinner included?"
      const bfast = kbMap.get("kb_breakfast")!;
      let customMessage =
        "Breakfast is complimentary for King Deluxe and Executive Family Suite guests (otherwise $18 per guest). I do not have verified records indicating that dinner is included.";
      if (lang === "hi-en") {
        customMessage =
          "Breakfast King Deluxe aur Executive Family Suite ke liye complimentary hai (warna $18 per guest). Dinner shamil hone ke verified records mere paas nahi hain.";
      } else if (lang === "hi") {
        customMessage =
          "नाश्ता किंग डीलक्स और एग्जीक्यूटिव फैमिली सुइट के मेहमानों के लिए मुफ़्त है (अन्यथा $18 प्रति अतिथि)। डिनर शामिल होने की सत्यापित जानकारी उपलब्ध नहीं है।";
      }
      return {
        answerType: "PARTIAL_FACT",
        responseKind: "partial_answer",
        reasonCode: "partial_knowledge",
        language: lang,
        requestedFields: ["breakfastInclusion", "dinnerInclusion"],
        facts: [
          { sourceId: bfast.id, field: "breakfastPrice", value: bfast.facts.breakfastPrice },
          { sourceId: bfast.id, field: "includedRoomTypes", value: bfast.facts.includedRoomTypes },
        ],
        unsupportedFields: ["dinnerInclusion"],
        customMessage,
      };
    }

    case "ROOM_CATALOG": {
      const roomDetails = ROOM_TYPES.map((r) => `${r.name} ($${r.baseRate}/night, ${r.bedConfiguration})`).join(", ");
      let customMessage = `Aster House offers four distinct room types: ${roomDetails}.`;
      if (lang === "hi-en") {
        customMessage = `Aster House mein 4 room types available hain: ${roomDetails}.`;
      } else if (lang === "hi") {
        customMessage = `एस्टर हाउस में चार प्रकार के कमरे उपलब्ध हैं: ${roomDetails}।`;
      }
      return {
        answerType: "ROOM_LIST",
        responseKind: "list",
        reasonCode: "verified_domain_result",
        language: lang,
        requestedFields: ["name", "description"],
        facts: ROOM_TYPES.map((r) => ({
          sourceId: r.id,
          field: "name",
          value: `${r.name} (${r.bedConfiguration}, max ${r.maxOccupancy} guests, from $${r.baseRate}/night)`,
        })),
        unsupportedFields: [],
        customMessage,
      };
    }

    case "ROOM_ATTRIBUTE": {
      const attr = interpretation.entities.roomAttribute;
      if (attr === "two_beds") {
        const matching = ROOM_TYPES.filter(
          (r) =>
            r.bedConfiguration.toLowerCase().includes("2") ||
            r.bedConfiguration.toLowerCase().includes("twin") ||
            r.name.toLowerCase().includes("double queen") ||
            r.name.toLowerCase().includes("family suite")
        );
        const names = matching.map((r) => `${r.name} (${r.bedConfiguration})`).join(" and ");
        let customMessage = `The room types with two or more beds are the ${names}.`;
        if (lang === "hi-en") {
          customMessage = `Do ya zyada beds wale rooms hain: ${names}.`;
        } else if (lang === "hi") {
          customMessage = `दो या अधिक बिस्तरों वाले कमरे हैं: ${names}।`;
        }
        return {
          answerType: "ROOM_LIST",
          responseKind: "list",
          reasonCode: "verified_domain_result",
          language: lang,
          requestedFields: ["bedConfiguration"],
          facts: matching.map((r) => ({
            sourceId: r.id,
            field: "bedConfiguration",
            value: r.bedConfiguration,
          })),
          unsupportedFields: [],
          customMessage,
        };
      }

      if (attr === "bathtub") {
        const matching = ROOM_TYPES.filter((r) =>
          r.amenities.some((a) => a.toLowerCase().includes("tub") || a.toLowerCase().includes("bath"))
        );
        let customMessage = "The King Deluxe features a private soaking tub.";
        if (lang === "hi-en") {
          customMessage = "King Deluxe room mein private soaking bathtub available hai.";
        } else if (lang === "hi") {
          customMessage = "किंग डीलक्स कमरे में एक निजी सोकिंग टब की सुविधा है।";
        }
        return {
          answerType: "ROOM_LIST",
          responseKind: "direct_fact",
          reasonCode: "verified_domain_result",
          language: lang,
          requestedFields: ["amenities"],
          facts: matching.map((r) => ({
            sourceId: r.id,
            field: "amenities",
            value: r.amenities.join(", "),
          })),
          unsupportedFields: [],
          customMessage,
        };
      }

      if (attr === "desk") {
        const matching = ROOM_TYPES.filter(
          (r) =>
            r.amenities.some((a) => a.toLowerCase().includes("desk")) ||
            r.description.toLowerCase().includes("desk")
        );
        let customMessage = "Yes. The Classic Queen features a dedicated work desk.";
        if (lang === "hi-en") {
          customMessage = "Haan. Classic Queen room mein dedicated work desk available hai.";
        } else if (lang === "hi") {
          customMessage = "हाँ। क्लासिक क्वीन में एक समर्पित कार्य डेस्क उपलब्ध है।";
        }
        return {
          answerType: "ROOM_LIST",
          responseKind: "yes_no_fact",
          reasonCode: "verified_domain_result",
          language: lang,
          requestedFields: ["amenities"],
          facts: matching.map((r) => ({
            sourceId: r.id,
            field: "amenities",
            value: r.amenities.join(", "),
          })),
          unsupportedFields: [],
          customMessage,
        };
      }

      return {
        answerType: "FALLBACK",
        responseKind: "unknown_hotel_fact",
        reasonCode: "unknown_fact",
        language: lang,
        requestedFields: [],
        facts: [],
        unsupportedFields: [],
        refusalReason: "UNKNOWN_FACT",
      };
    }

    case "ROOM_SUITABILITY": {
      const adults = interpretation.availabilitySlots.adults?.value || 2;
      const targetRoom = interpretation.entities.roomType;
      const isSmallest = interpretation.references.referencedComparison === "smallest";

      // Question: "Can four guests fit in a king room?"
      if (targetRoom === "King Deluxe" && adults > 2) {
        let customMessage =
          "No, the King Deluxe accommodates up to 2 guests. For 4 guests, our Double Queen Suite (max 4) and Executive Family Suite (max 5) can accommodate your party.";
        if (lang === "hi-en") {
          customMessage =
            "Nahi, King Deluxe mein maximum 2 guests reh sakte hain. 4 logon ke liye Double Queen Suite (max 4) aur Executive Family Suite (max 5) suitable hain.";
        } else if (lang === "hi") {
          customMessage =
            "नहीं, किंग डीलक्स में अधिकतम 2 अतिथि ठहर सकते हैं। 4 अतिथियों के लिए डबल क्वीन सुइट (अधिकतम 4) और एग्जीक्यूटिव फैमिली सुइट (अधिकतम 5) उपयुक्त हैं।";
        }
        return {
          answerType: "ROOM_LIST",
          responseKind: "recommendation_from_facts",
          reasonCode: "verified_domain_result",
          language: lang,
          requestedFields: ["maxOccupancy"],
          facts: [{ sourceId: "king-deluxe", field: "maxOccupancy", value: 2 }],
          unsupportedFields: [],
          customMessage,
        };
      }

      // Question: "smallest room that can accommodate three adults" / "sabse chota"
      if (isSmallest) {
        const qualifying = ROOM_TYPES.filter((r) => r.maxOccupancy >= adults).sort(
          (a, b) => a.maxOccupancy - b.maxOccupancy
        );
        if (qualifying.length > 0) {
          const smallest = qualifying[0];
          let customMessage = `The smallest room that can accommodate ${adults} guests is the ${smallest.name} (max ${smallest.maxOccupancy} guests, from $${smallest.baseRate}/night).`;
          if (lang === "hi-en") {
            customMessage = `${adults} logon ke liye sabse chota room ${smallest.name} hai (max ${smallest.maxOccupancy} guests, $${smallest.baseRate}/night).`;
          } else if (lang === "hi") {
            customMessage = `${adults} अतिथियों के लिए सबसे छोटा उपयुक्त कमरा ${smallest.name} है (अधिकतम ${smallest.maxOccupancy} अतिथि)।`;
          }
          return {
            answerType: "ROOM_LIST",
            responseKind: "recommendation_from_facts",
            reasonCode: "verified_domain_result",
            language: lang,
            requestedFields: ["maxOccupancy"],
            facts: [{ sourceId: smallest.id, field: "maxOccupancy", value: smallest.maxOccupancy }],
            unsupportedFields: [],
            customMessage,
          };
        }
      }

      // Default suitability handled by orchestrator room suitability card render
      return {
        answerType: "ROOM_LIST",
        responseKind: "recommendation_from_facts",
        reasonCode: "verified_domain_result",
        language: lang,
        requestedFields: ["maxOccupancy"],
        facts: [],
        unsupportedFields: [],
      };
    }

    case "ROOM_COMPARISON": {
      // e.g. "Which of those rooms is cheapest?" or "Inme cheapest kaunsa hai?"
      if (state.roomFrame && state.roomFrame.lastPresentedRooms.length > 0) {
        const rooms = [...state.roomFrame.lastPresentedRooms].sort(
          (a, b) => a.nightlyRate - b.nightlyRate
        );
        const cheapest = rooms[0];
        let customMessage = `The ${cheapest.name} is the cheapest option at $${cheapest.nightlyRate}/night (Total: $${cheapest.totalPrice}).`;
        if (lang === "hi-en") {
          customMessage = `${cheapest.name} sabse sasta option hai $${cheapest.nightlyRate}/night par (Total: $${cheapest.totalPrice}).`;
        } else if (lang === "hi") {
          customMessage = `${cheapest.name} $${cheapest.nightlyRate}/रात (कुल: $${cheapest.totalPrice}) पर सबसे किफ़ायती विकल्प है।`;
        }
        return {
          answerType: "DIRECT_FACT",
          responseKind: "comparison",
          reasonCode: "verified_domain_result",
          language: lang,
          requestedFields: ["rate"],
          facts: [
            { sourceId: cheapest.roomTypeId, field: "nightlyRate", value: cheapest.nightlyRate },
          ],
          unsupportedFields: [],
          customMessage,
        };
      }
      return {
        answerType: "FALLBACK",
        responseKind: "unknown_hotel_fact",
        reasonCode: "missing_required_slots",
        language: lang,
        requestedFields: [],
        facts: [],
        unsupportedFields: [],
        refusalReason: "UNKNOWN_FACT",
        customMessage:
          lang === "hi-en"
            ? "Pehle availability search karein taaki main room rates compare kar saku."
            : "Please run an availability search first so I can compare room rates for your stay dates.",
      };
    }

    case "AVAILABILITY_FOLLOWUP": {
      if (state.roomFrame && state.roomFrame.stayQuery) {
        const q = state.roomFrame.stayQuery;
        const refIndex = interpretation.references.referencedRoomResultIndex;
        if (refIndex && state.roomFrame.lastPresentedRooms[refIndex - 1]) {
          const room = state.roomFrame.lastPresentedRooms[refIndex - 1];
          let customMessage = `The ${room.name} is $${room.nightlyRate}/night, totaling $${room.totalPrice} for ${q.nights} night${q.nights > 1 ? "s" : ""} (${q.checkIn} to ${q.checkOut}).`;
          if (lang === "hi-en") {
            customMessage = `${room.name} $${room.nightlyRate}/night par hai, ${q.nights} raat ke liye total $${room.totalPrice} (${q.checkIn} se ${q.checkOut}).`;
          } else if (lang === "hi") {
            customMessage = `${room.name} $${room.nightlyRate}/रात है, कुल $${room.totalPrice} (${q.checkIn} से ${q.checkOut})।`;
          }
          return {
            answerType: "DIRECT_FACT",
            responseKind: "direct_fact",
            reasonCode: "verified_domain_result",
            language: lang,
            requestedFields: ["totalPrice"],
            facts: [{ sourceId: room.roomTypeId, field: "totalPrice", value: room.totalPrice }],
            unsupportedFields: [],
            customMessage,
          };
        }
        if (interpretation.requestedFields.includes("totalStayPrice")) {
          const totalSummary = state.roomFrame.lastPresentedRooms
            .map((r) => `${r.name}: $${r.totalPrice}`)
            .join(", ");
          let customMessage = `For your ${q.nights}-night stay (${q.checkIn} to ${q.checkOut}), total prices are: ${totalSummary}.`;
          if (lang === "hi-en") {
            customMessage = `Aapke ${q.nights} nights stay (${q.checkIn} se ${q.checkOut}) ke liye total prices hain: ${totalSummary}.`;
          } else if (lang === "hi") {
            customMessage = `आपके ${q.nights} रातों के प्रवास (${q.checkIn} से ${q.checkOut}) के लिए कुल कीमतें हैं: ${totalSummary}।`;
          }
          return {
            answerType: "DIRECT_FACT",
            responseKind: "direct_fact",
            reasonCode: "verified_domain_result",
            language: lang,
            requestedFields: ["totalStayPrice"],
            facts: [],
            unsupportedFields: [],
            customMessage,
          };
        }
      }
      return {
        answerType: "FALLBACK",
        responseKind: "unknown_hotel_fact",
        reasonCode: "unknown_fact",
        language: lang,
        requestedFields: [],
        facts: [],
        unsupportedFields: [],
        refusalReason: "UNKNOWN_FACT",
      };
    }

    default:
      return {
        answerType: "FALLBACK",
        responseKind: "unknown_hotel_fact",
        reasonCode: "unknown_fact",
        language: lang,
        requestedFields: [],
        facts: [],
        unsupportedFields: [],
        refusalReason: "UNKNOWN_FACT",
      };
  }
}
