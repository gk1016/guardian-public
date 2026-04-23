/// Session data extracted from a verified JWT.
/// Used by route handlers via the AuthSession extractor.
#[derive(Debug, Clone)]
pub struct Session {
    pub user_id: String,
    pub email: String,
    pub handle: String,
    pub role: String,
    pub display_name: Option<String>,
    pub status: String,
    pub org_id: Option<String>,
    pub org_tag: Option<String>,
    pub iat: i64,
}

impl Session {
    /// Returns true if the user can manage administration resources.
    pub fn can_manage_administration(&self) -> bool {
        matches!(self.role.as_str(), "admin" | "commander")
    }

    /// Returns true if the user can manage operations resources.
    pub fn can_manage_operations(&self) -> bool {
        matches!(self.role.as_str(), "admin" | "commander" | "director" | "rescue_coordinator")
    }

    /// Returns true if the user can manage missions.
    pub fn can_manage_missions(&self) -> bool {
        matches!(self.role.as_str(), "admin" | "commander" | "director")
    }
}
