//! Clearance enforcement and message filtering.
//!
//! Server-enforced access control — the WS room broadcast filters
//! per-recipient based on clearance vs. message classification.

use crate::types::{Classification, Clearance};

/// Check if a participant's clearance allows them to see a message
/// with the given classification.
pub fn can_see_message(clearance: Clearance, classification: Classification) -> bool {
    (clearance as u8) >= (classification as u8)
}

/// Check if a participant can see another participant in the channel.
pub fn can_see_participant(viewer_clearance: Clearance, target_clearance: Clearance) -> bool {
    match viewer_clearance {
        Clearance::Full => true,
        Clearance::Tactical => target_clearance != Clearance::Customer,
        Clearance::Customer => target_clearance == Clearance::Full,
    }
}

/// Check if a participant can send messages with a given classification.
pub fn can_send_classification(clearance: Clearance, classification: Classification) -> bool {
    (clearance as u8) >= (classification as u8)
}

/// Determine the maximum classification a sender with this clearance can use.
pub fn max_classification(clearance: Clearance) -> Classification {
    match clearance {
        Clearance::Customer => Classification::Unclass,
        Clearance::Tactical => Classification::Restricted,
        Clearance::Full => Classification::Internal,
    }
}

/// Parse clearance from string (database value).
pub fn parse_clearance(s: &str) -> Clearance {
    match s {
        "full" => Clearance::Full,
        "tactical" => Clearance::Tactical,
        "customer" => Clearance::Customer,
        _ => Clearance::Customer,
    }
}

/// Parse classification from string (database value).
pub fn parse_classification(s: &str) -> Classification {
    match s {
        "internal" => Classification::Internal,
        "restricted" => Classification::Restricted,
        _ => Classification::Unclass,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clearance_filtering() {
        assert!(can_see_message(Clearance::Full, Classification::Internal));
        assert!(can_see_message(Clearance::Full, Classification::Restricted));
        assert!(can_see_message(Clearance::Full, Classification::Unclass));

        assert!(!can_see_message(Clearance::Tactical, Classification::Internal));
        assert!(can_see_message(Clearance::Tactical, Classification::Restricted));
        assert!(can_see_message(Clearance::Tactical, Classification::Unclass));

        assert!(!can_see_message(Clearance::Customer, Classification::Internal));
        assert!(!can_see_message(Clearance::Customer, Classification::Restricted));
        assert!(can_see_message(Clearance::Customer, Classification::Unclass));
    }

    #[test]
    fn participant_visibility() {
        assert!(can_see_participant(Clearance::Full, Clearance::Customer));
        assert!(!can_see_participant(Clearance::Tactical, Clearance::Customer));
        assert!(can_see_participant(Clearance::Customer, Clearance::Full));
        assert!(!can_see_participant(Clearance::Customer, Clearance::Tactical));
    }
}
