pub struct MissionTemplateSlot {
    pub role: &'static str,
    pub platform: &'static str,
    pub notes: &'static str,
}

pub struct MissionTemplate {
    pub code: &'static str,
    pub label: &'static str,
    pub doctrine_code: &'static str,
    pub slots: &'static [MissionTemplateSlot],
}

static TEMPLATES: &[MissionTemplate] = &[
    MissionTemplate {
        code: "counter-piracy",
        label: "Counter-Piracy Escort",
        doctrine_code: "weapons_tight",
        slots: &[
            MissionTemplateSlot { role: "escort wing", platform: "F7A Mk II", notes: "Primary escort element responsible for fixing hostile intercept geometry." },
            MissionTemplateSlot { role: "reserve element", platform: "F8C Lightning", notes: "Hold reserve posture and reinforce the merge only on command." },
        ],
    },
    MissionTemplate {
        code: "qrf",
        label: "Quick Reaction Force",
        doctrine_code: "weapons_free",
        slots: &[
            MissionTemplateSlot { role: "response wing", platform: "F8C Lightning", notes: "Immediate response wing prepared to reinforce the threatened sector without delay." },
        ],
    },
    MissionTemplate {
        code: "csar",
        label: "Combat Search And Rescue",
        doctrine_code: "weapons_free",
        slots: &[
            MissionTemplateSlot { role: "rescue bird", platform: "Cutlass Red", notes: "Primary medevac and survivor recovery ship." },
            MissionTemplateSlot { role: "escort element", platform: "F7A Mk II", notes: "Protect the rescue corridor and prevent hostile re-attack geometry." },
        ],
    },
    MissionTemplate {
        code: "recon",
        label: "Recon / Surveillance",
        doctrine_code: "weapons_hold",
        slots: &[
            MissionTemplateSlot { role: "overwatch", platform: "Hornet Tracker", notes: "Maintain standoff cover and preserve the reporting lane for the recon lead." },
        ],
    },
];

pub fn get_template(code_or_type: &str) -> &'static MissionTemplate {
    let normalized = code_or_type.trim().to_lowercase();
    TEMPLATES.iter()
        .find(|t| t.code == normalized)
        .or_else(|| TEMPLATES.iter().find(|t| normalized.contains(t.code)))
        .unwrap_or(&TEMPLATES[0])
}
